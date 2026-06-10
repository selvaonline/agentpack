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
  /** Default (first) pack's registry and pack, for backward compatibility. */
  registry: ToolRegistry;
  pack: AgentPack;
  packs: AgentPack[];
}

/** Sliding-window rate limit per client IP. LLM runs cost real money, so the
 * run endpoint is limited by default (AGENTPACK_RUN_LIMIT per hour, 0 = off). */
function rateLimit(limitPerHour: number) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (limitPerHour <= 0) return next();
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const w = windows.get(ip);
    if (!w || now > w.resetAt) {
      windows.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
      if (windows.size > 10000) {
        for (const [k, v] of windows) if (now > v.resetAt) windows.delete(k);
      }
      return next();
    }
    if (w.count >= limitPerHour) {
      res.status(429).json({ error: "rate limit exceeded — try again later" });
      return;
    }
    w.count++;
    next();
  };
}

/** Serve one pack — or several, switchable in the UI and addressable via the
 * `pack` query/body param on every endpoint (defaults to the first pack). */
export function createServer(packOrPacks: AgentPack | AgentPack[]): AgentpackServer {
  const packs = Array.isArray(packOrPacks) ? packOrPacks : [packOrPacks];
  if (packs.length === 0) throw new Error("[agentpack] createServer needs at least one pack");
  const entries = new Map(packs.map((p) => [p.name, { pack: p, registry: buildRegistry(p) }]));
  const defaultEntry = entries.get(packs[0].name)!;
  const app = express();

  // Default pack at /mcp (backward compatible); every pack at /mcp/<name>.
  app.use("/mcp", mcpRouter(defaultEntry.pack, defaultEntry.registry));
  for (const { pack, registry } of entries.values()) {
    app.use(`/mcp/${encodeURIComponent(pack.name)}`, mcpRouter(pack, registry));
  }
  app.use(express.json({ limit: "1mb" }));

  /** Resolve the target pack from ?pack= or body.pack; falls back to default. */
  function resolve(req: express.Request): { pack: AgentPack; registry: ToolRegistry } | undefined {
    const name = (req.query.pack as string) || req.body?.pack;
    if (!name) return defaultEntry;
    return entries.get(name);
  }

  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(devUiHtml(packs));
  });

  app.get("/api/health", (_req, res) => res.json({ ok: hasLlmKey(), packs: packs.map((p) => p.name) }));

  app.get("/api/packs", (_req, res) => {
    res.json({
      packs: packs.map((p) => ({
        name: p.name,
        description: p.description || "",
        supervisor: p.supervisor.name,
        specialists: p.specialists.length,
        tools: p.tools.length,
        examples: p.examples || [],
      })),
    });
  });

  app.get("/api/network", (req, res) => {
    const entry = resolve(req);
    if (!entry) { res.status(404).json({ error: "unknown pack" }); return; }
    res.json(networkTopology(entry.pack));
  });

  app.get("/api/tools", (req, res) => {
    const entry = resolve(req);
    if (!entry) { res.status(404).json({ error: "unknown pack" }); return; }
    res.json({
      tools: entry.registry.list().map((t) => ({
        name: t.schema.name,
        description: t.schema.description,
        category: t.category || "tool",
        parameters: t.schema.parameters,
      })),
    });
  });

  app.post("/api/tools/execute", async (req, res) => {
    const entry = resolve(req);
    if (!entry) { res.status(404).json({ ok: false, error: "unknown pack" }); return; }
    const { tool: toolName, args = {} } = req.body || {};
    const reg = entry.registry.get(toolName);
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

  const runLimiter = rateLimit(Number(process.env.AGENTPACK_RUN_LIMIT ?? 30));
  app.post("/api/run", runLimiter, (req, res) => {
    const entry = resolve(req);
    if (!entry) { res.status(404).json({ error: "unknown pack" }); return; }
    const { pack, registry } = entry;
    const { query, threadId: clientThreadId } = req.body || {};
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query required" });
      return;
    }
    const runId = crypto.randomBytes(8).toString("hex");
    const threadId = (typeof clientThreadId === "string" && /^[\w-]{4,64}$/.test(clientThreadId))
      ? clientThreadId
      : runId;
    res.json({ runId, threadId, pack: pack.name });

    (async () => {
      const emit = (kind: string, payload: Record<string, unknown> = {}) =>
        publish(runId, { kind, runId, t: Date.now(), ...payload });
      await new Promise((r) => setTimeout(r, 200));
      emit("run_started", { query, pack: pack.name });
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

  return { app, registry: defaultEntry.registry, pack: defaultEntry.pack, packs };
}
