// agentpack — server factory. createServer(pack) wires everything:
//   GET  /                    dev UI (live agent network + chat)
//   GET  /api/health          { ok } when an LLM key is configured
//   GET  /api/network         {nodes, edges} topology
//   POST /api/run             { query, threadId? } -> { runId, threadId }
//   GET  /events/:runId       SSE stream of run events
//   GET  /api/tools           tool registry (schemas)
//   POST /api/tools/execute   zero-token direct tool execution
//   ALL  /mcp                 auto-generated MCP server
import express from "express";
import crypto from "node:crypto";
import type { AgentPack } from "./types.js";
import { buildRegistry, networkTopology, ToolRegistry } from "./registry.js";
import { runSupervisor } from "./supervisor.js";
import { publish, subscribe, scheduleCleanup } from "./events.js";
import { mcpRouter } from "./mcp.js";
import { devUiHtml } from "./devui.js";
import { hasLlmKey } from "./llm.js";

export interface AgentpackServer {
  app: express.Express;
  registry: ToolRegistry;
  pack: AgentPack;
}

export function createServer(pack: AgentPack): AgentpackServer {
  const registry = buildRegistry(pack);
  const app = express();

  app.use("/mcp", mcpRouter(pack, registry));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(devUiHtml(pack));
  });

  app.get("/api/health", (_req, res) => res.json({ ok: hasLlmKey() }));
  app.get("/api/network", (_req, res) => res.json(networkTopology(pack)));

  app.get("/api/tools", (_req, res) => {
    res.json({
      tools: registry.list().map((t) => ({
        name: t.schema.name,
        description: t.schema.description,
        category: t.category || "tool",
        parameters: t.schema.parameters,
      })),
    });
  });

  app.post("/api/tools/execute", async (req, res) => {
    const { tool: toolName, args = {} } = req.body || {};
    const reg = registry.get(toolName);
    if (!reg) {
      res.status(404).json({ ok: false, error: `unknown tool: ${toolName}` });
      return;
    }
    try {
      const result = await reg.execute(args, {});
      res.json({ ok: true, tool: toolName, result });
    } catch (e: any) {
      res.status(500).json({ ok: false, tool: toolName, error: e?.message || String(e) });
    }
  });

  app.post("/api/run", (req, res) => {
    const { query, threadId: clientThreadId } = req.body || {};
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query required" });
      return;
    }
    const runId = crypto.randomBytes(8).toString("hex");
    const threadId = (typeof clientThreadId === "string" && /^[\w-]{4,64}$/.test(clientThreadId))
      ? clientThreadId
      : runId;
    res.json({ runId, threadId });

    (async () => {
      const emit = (kind: string, payload: Record<string, unknown> = {}) =>
        publish(runId, { kind, runId, t: Date.now(), ...payload });
      await new Promise((r) => setTimeout(r, 200));
      emit("run_started", { query });
      emit("thinking", { text: `${pack.supervisor.name} is planning the work...` });
      try {
        const { answer, hops } = await runSupervisor(pack, registry, query, runId, emit, threadId);
        if (answer) {
          emit("answer_chunk", { text: answer });
          emit("answer_complete", {});
        }
        emit("run_finished", { ok: true, hops });
      } catch (e: any) {
        console.error("[agentpack] run error:", e?.message || e);
        emit("thinking", { text: `Error: ${e?.message || e}` });
        emit("run_finished", { ok: false });
      } finally {
        scheduleCleanup(runId);
      }
    })();
  });

  app.get("/events/:runId", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const unsubscribe = subscribe(req.params.runId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event["kind"] === "run_finished") res.end();
    });
    req.on("close", unsubscribe);
  });

  return { app, registry, pack };
}
