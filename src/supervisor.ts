// agentpack — LangGraph.js supervisor over a pack's specialist team.
// Runs in-process: specialists call the tool registry directly. Emits the
// agentpack event vocabulary (see types.ts) so the dev UI and eval harness
// work for any pack.
import crypto from "node:crypto";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { AgentPack, Emit, SpecialistSpec } from "./types.js";
import type { ToolRegistry } from "./registry.js";
import { jsonSchemaToZod } from "./jsonSchemaToZod.js";
import { makeModel, makeSupervisorModel } from "./llm.js";
import { waitForApproval } from "./events.js";
import { withGuardrails } from "./guardrails.js";

const pretty = (id: string) => id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// LangChain core warns on every streamed chunk when OpenAI-compatible
// providers (e.g. Gemini) repeat numeric usage fields in each chunk's
// response_metadata. Harmless but extremely noisy — filter just that line.
const origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("already exists in this message chunk")) return;
  origWarn(...args);
};

const text = (content: any): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c: any) => c?.text || "").join("")
      : JSON.stringify(content);

/** Wrap one registry tool for a given specialist, with live event emission. */
function makeRegistryTool(
  pack: AgentPack, registry: ToolRegistry,
  toolName: string, specialist: string, runId: string, emit: Emit, hops: { n: number }
) {
  const reg = registry.get(toolName);
  if (!reg) throw new Error(`[agentpack] tool ${toolName} not in registry`);

  return tool(
    async (args: Record<string, any>) => {
      // strip nulls so tool destructuring defaults apply
      const clean = Object.fromEntries(
        Object.entries(args || {}).filter(([, v]) => v !== null && v !== undefined)
      );
      hops.n++;
      emit("hop", { chain: [pack.supervisor.name, specialist, toolName], target: toolName, targetType: "tool" });
      emit("tool_executing", { toolName, agent: specialist });
      emit("agent_step", { hop: hops.n, type: "tool_call", toolName, content: `${pretty(specialist)} → ${pretty(toolName)}` });
      const t0 = Date.now();
      try {
        const result = await reg.execute(clean, { runId, emit });
        const out = JSON.stringify(result ?? null);
        emit("tool_complete", { toolName, agent: specialist, durationMs: Date.now() - t0 });
        emit("agent_step", { hop: hops.n, type: "tool_result", toolName, toolResult: out.slice(0, 400), durationMs: Date.now() - t0 });
        return out.length > 24000 ? out.slice(0, 24000) + "…(truncated)" : out;
      } catch (e: any) {
        emit("tool_complete", { toolName, agent: specialist, durationMs: Date.now() - t0, error: true });
        return `ERROR from ${toolName}: ${e?.message || e}`;
      }
    },
    {
      name: toolName,
      description: reg.schema.description,
      schema: jsonSchemaToZod(reg.schema.parameters),
    }
  );
}

interface Usage { input: number; output: number }

/** Accumulate token usage from any message that carries usage_metadata. */
function addUsage(usage: Usage, messages: any[]): boolean {
  let changed = false;
  for (const m of messages) {
    const u = m?.usage_metadata;
    if (u) {
      usage.input += u.input_tokens || 0;
      usage.output += u.output_tokens || 0;
      changed = true;
    }
  }
  return changed;
}

/** Expose one specialist sub-agent as a supervisor tool. */
function makeSpecialistTool(
  pack: AgentPack, registry: ToolRegistry,
  spec: SpecialistSpec, model: ChatOpenAI, runId: string, emit: Emit, hops: { n: number },
  recordUsage: (messages: any[]) => void
) {
  const supervisorLabel = pretty(pack.supervisor.name);
  const agent = createReactAgent({
    llm: model,
    tools: spec.tools.map((t) => makeRegistryTool(pack, registry, t, spec.name, runId, emit, hops)),
    prompt: withGuardrails(spec.prompt, pack.guardrails),
  });

  return tool(
    async ({ inquiry, context }: { inquiry: string; context?: string | null }) => {
      // Human-in-the-loop gate: pause until the user approves this step.
      if (spec.approval) {
        const approvalId = crypto.randomBytes(6).toString("hex");
        emit("approval_request", { approvalId, specialist: spec.name, inquiry: inquiry.slice(0, 300) });
        emit("thinking", { text: `⏸ waiting for approval to run ${pretty(spec.name)}…` });
        const approved = await waitForApproval(runId, approvalId);
        emit("approval_resolved", { approvalId, approved });
        if (!approved) {
          emit("thinking", { text: `✗ ${pretty(spec.name)} was declined by the user` });
          return `The user DECLINED running ${spec.name} for this request. Do not retry it; note the omission in your final answer.`;
        }
      }
      hops.n++;
      emit("hop", { chain: [pack.supervisor.name, spec.name], target: spec.name, targetType: "specialist" });
      emit("thinking", { text: `${supervisorLabel} → delegating to ${pretty(spec.name)}` });
      emit("agent_step", { hop: hops.n, type: "delegate", toolName: spec.name, content: `${supervisorLabel} → ${pretty(spec.name)}: ${inquiry.slice(0, 160)}` });

      const input = context ? `${inquiry}\n\nContext from other specialists:\n${context}` : inquiry;
      const res = await agent.invoke(
        { messages: [new HumanMessage(input)] },
        { recursionLimit: 24 }
      );
      recordUsage(res.messages);
      const finding = text(res.messages[res.messages.length - 1]?.content ?? "");

      emit("thinking", { text: `✓ ${pretty(spec.name)}: ${finding.slice(0, 160)}${finding.length > 160 ? "…" : ""}` });
      emit("agent_step", { hop: hops.n, type: "finding", toolName: spec.name, content: finding });
      emit("hop", { chain: [pack.supervisor.name], target: pack.supervisor.name, targetType: "supervisor" });
      return finding;
    },
    {
      name: spec.name,
      description: spec.description,
      schema: z.object({
        inquiry: z.string().describe("The specific question or task for this specialist."),
        context: z.string().nullable().optional()
          .describe("Relevant findings from other specialists."),
      }),
    }
  );
}

// Conversation memory: checkpoints supervisor message history per thread_id,
// so follow-up queries carry full context. In-process only.
const checkpointer = new MemorySaver();

/** Run one query through the pack's supervisor. Streams the final answer
 * token-by-token (answer_token events) and returns the complete markdown. */
export async function runSupervisor(
  pack: AgentPack,
  registry: ToolRegistry,
  query: string,
  runId: string,
  emit: Emit,
  threadId?: string
): Promise<{ answer: string; hops: number }> {
  const specialistModel = makeModel();
  const hops = { n: 0 };
  const usage: Usage = { input: 0, output: 0 };
  // Per-message supervisor usage: providers report usage_metadata cumulatively
  // per message (or once on the final chunk), so keep the latest value per id.
  const supUsage = new Map<string, { input: number; output: number }>();
  const emitTotals = () => {
    let input = usage.input, output = usage.output;
    for (const u of supUsage.values()) { input += u.input; output += u.output; }
    emit("usage", { inputTokens: input, outputTokens: output });
  };
  const recordUsage = (messages: any[]) => { if (addUsage(usage, messages)) emitTotals(); };

  const supervisor = createReactAgent({
    llm: makeSupervisorModel(),
    tools: pack.specialists.map((s) => makeSpecialistTool(pack, registry, s, specialistModel, runId, emit, hops, recordUsage)),
    prompt: withGuardrails(pack.supervisor.prompt, pack.guardrails),
    checkpointer,
  });

  const config = { recursionLimit: 40, configurable: { thread_id: threadId || runId } };

  // Stream supervisor LLM tokens live. Each AI message is a segment; a new
  // segment means the previous one was intermediate reasoning — reset it.
  // The last segment is the final answer.
  let answer = "";
  let segmentId: string | undefined;
  let streamed = false;
  try {
    const stream = await supervisor.stream(
      { messages: [new HumanMessage(query)] },
      { ...config, streamMode: "messages" } as any
    );
    for await (const item of stream as any) {
      const msg = Array.isArray(item) ? item[0] : item;
      if (!msg) continue;
      const type = typeof msg._getType === "function" ? msg._getType() : msg.type;
      if (type !== "ai" && type !== "AIMessageChunk") continue;
      const id = msg.id || "segment";
      const u = msg.usage_metadata;
      if (u) {
        supUsage.set(id, { input: u.input_tokens || 0, output: u.output_tokens || 0 });
        emitTotals();
      }
      const t = text(msg.content ?? "");
      if (id !== segmentId) {
        segmentId = id;
        if (answer) emit("answer_reset", {});
        answer = "";
      }
      if (t) {
        answer += t;
        streamed = true;
        emit("answer_token", { text: t });
      }
    }
  } catch (e) {
    if (streamed) throw e;
    // Streaming unsupported by this model/provider — fall back to invoke.
    const res = await supervisor.invoke({ messages: [new HumanMessage(query)] }, config);
    recordUsage(res.messages);
    answer = text(res.messages[res.messages.length - 1]?.content ?? "");
  }
  return { answer, hops: hops.n };
}
