// agentpack — LangGraph.js supervisor over a pack's specialist team.
// Runs in-process: specialists call the tool registry directly. Emits the
// agentpack event vocabulary (see types.ts) so the dev UI and eval harness
// work for any pack.
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

const pretty = (id: string) => id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

/** Expose one specialist sub-agent as a supervisor tool. */
function makeSpecialistTool(
  pack: AgentPack, registry: ToolRegistry,
  spec: SpecialistSpec, model: ChatOpenAI, runId: string, emit: Emit, hops: { n: number }
) {
  const supervisorLabel = pretty(pack.supervisor.name);
  const agent = createReactAgent({
    llm: model,
    tools: spec.tools.map((t) => makeRegistryTool(pack, registry, t, spec.name, runId, emit, hops)),
    prompt: spec.prompt,
  });

  return tool(
    async ({ inquiry, context }: { inquiry: string; context?: string | null }) => {
      hops.n++;
      emit("hop", { chain: [pack.supervisor.name, spec.name], target: spec.name, targetType: "specialist" });
      emit("thinking", { text: `${supervisorLabel} → delegating to ${pretty(spec.name)}` });
      emit("agent_step", { hop: hops.n, type: "delegate", toolName: spec.name, content: `${supervisorLabel} → ${pretty(spec.name)}: ${inquiry.slice(0, 160)}` });

      const input = context ? `${inquiry}\n\nContext from other specialists:\n${context}` : inquiry;
      const res = await agent.invoke(
        { messages: [new HumanMessage(input)] },
        { recursionLimit: 24 }
      );
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

/** Run one query through the pack's supervisor. Returns the final markdown answer. */
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

  const supervisor = createReactAgent({
    llm: makeSupervisorModel(),
    tools: pack.specialists.map((s) => makeSpecialistTool(pack, registry, s, specialistModel, runId, emit, hops)),
    prompt: pack.supervisor.prompt,
    checkpointer,
  });

  const res = await supervisor.invoke(
    { messages: [new HumanMessage(query)] },
    { recursionLimit: 40, configurable: { thread_id: threadId || runId } }
  );
  return { answer: text(res.messages[res.messages.length - 1]?.content ?? ""), hops: hops.n };
}
