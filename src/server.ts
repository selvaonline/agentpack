// agentpack — server factory. createServer(pack) wires everything:
//   GET  /                    dev UI (live agent network + chat)
//   GET  /api/health          { ok } when an LLM key is configured
//   GET  /api/network         {nodes, edges} topology
//   POST /api/run             { query, threadId? } -> { runId, threadId }
//   GET  /api/stream/:runId   SSE stream of run events (/events/:runId alias)
//   GET  /api/tools           tool registry (schemas)
//   POST /api/tools/execute   zero-token direct tool execution
//   ALL  /mcp                 auto-generated MCP server
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentPack } from "./types.js";
import { buildRegistry, networkTopology, ToolRegistry } from "./registry.js";
import { runSupervisor } from "./supervisor.js";
import { publish, subscribe, scheduleCleanup, resolveApproval } from "./events.js";
import { mcpRouter } from "./mcp.js";
import { defaultSupervisorPrompt } from "./manifest.js";
import { devUiHtml } from "./devui.js";
import { widgetJs } from "./widget.js";
import { hasLlmKey, makeModel } from "./llm.js";

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

interface PackEntry {
  pack: AgentPack;
  registry: ToolRegistry;
  custom?: boolean;
  createdAt?: number;
  /** Lazily-created MCP router for dynamic (browser-built) packs. */
  mcp?: express.Router;
}

const DYNAMIC_PACK_TTL_MS = Number(process.env.AGENTPACK_PACK_TTL_HOURS || 24) * 60 * 60 * 1000;
const DYNAMIC_PACK_MAX = 50;
/** Browser-built packs survive server restarts via small JSON files. */
const DATA_DIR = process.env.AGENTPACK_DATA_DIR || path.join(os.tmpdir(), "agentpack-packs");

interface CustomPackSpec {
  name: string;
  title?: string;
  description?: string;
  supervisorName: string;
  supervisorInstructions?: string;
  specialists: Array<{ name: string; description: string; prompt: string; tools: string[]; approval?: boolean }>;
  createdAt: number;
}

/** Serve one pack — or several, switchable in the UI and addressable via the
 * `pack` query/body param on every endpoint (defaults to the first pack).
 * Visitors can also compose ephemeral custom teams from the loaded tool
 * catalog via POST /api/packs (disable with AGENTPACK_DYNAMIC=0). */
export function createServer(packOrPacks: AgentPack | AgentPack[]): AgentpackServer {
  const packs = Array.isArray(packOrPacks) ? packOrPacks : [packOrPacks];
  if (packs.length === 0) throw new Error("[agentpack] createServer needs at least one pack");
  const entries = new Map<string, PackEntry>(
    packs.map((p) => [p.name, { pack: p, registry: buildRegistry(p) }])
  );
  const defaultEntry = entries.get(packs[0].name)!;
  const dynamicEnabled = process.env.AGENTPACK_DYNAMIC !== "0";

  // Union of every static pack's tools — what custom teams can be built from.
  const toolCatalog = new Map<string, { tool: (typeof packs)[0]["tools"][0]; source: string }>();
  for (const p of packs) {
    for (const t of p.tools) {
      if (!toolCatalog.has(t.schema.name)) toolCatalog.set(t.schema.name, { tool: t, source: p.name });
    }
  }

  function evictExpired() {
    const now = Date.now();
    for (const [name, e] of entries) {
      if (e.custom && e.createdAt && now - e.createdAt > DYNAMIC_PACK_TTL_MS) {
        entries.delete(name);
        fs.rmSync(path.join(DATA_DIR, `${name}.json`), { force: true });
      }
    }
  }

  /** Build + register a custom pack from a sanitized spec. Returns the final
   * (de-collided) name. */
  function registerCustomPack(spec: CustomPackSpec, persist: boolean): string {
    let name = spec.name;
    let n = 2;
    while (entries.has(name)) name = `${spec.name}-${n++}`;

    let supPrompt = defaultSupervisorPrompt(spec.supervisorName, spec.specialists);
    if (spec.supervisorInstructions) {
      supPrompt += `\n\nAdditional instructions:\n${spec.supervisorInstructions}`;
    }
    const usedTools = new Set<string>(spec.specialists.flatMap((s) => s.tools));
    const pack: AgentPack = {
      name,
      title: spec.title,
      description: spec.description || "Custom agent (built in the browser)",
      supervisor: { name: spec.supervisorName, prompt: supPrompt },
      specialists: spec.specialists,
      tools: Array.from(usedTools).map((t) => toolCatalog.get(t)!.tool),
      examples: [],
    };
    const registry = buildRegistry(pack);
    entries.set(name, { pack, registry, custom: true, createdAt: spec.createdAt, mcp: mcpRouter(pack, registry) });
    if (persist) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify({ ...spec, name }, null, 2));
    }
    return name;
  }

  // Reload previously built custom packs that haven't expired yet.
  if (dynamicEnabled && fs.existsSync(DATA_DIR)) {
    for (const f of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
      try {
        const spec = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")) as CustomPackSpec;
        const expired = Date.now() - spec.createdAt > DYNAMIC_PACK_TTL_MS;
        const toolsOk = spec.specialists.every((s) => s.tools.every((t) => toolCatalog.has(t)));
        if (expired || !toolsOk) {
          fs.rmSync(path.join(DATA_DIR, f), { force: true });
          continue;
        }
        registerCustomPack(spec, false);
      } catch { /* skip corrupt files */ }
    }
  }

  const app = express();

  // Default pack at /mcp (backward compatible); every static pack at /mcp/<name>.
  app.use("/mcp", mcpRouter(defaultEntry.pack, defaultEntry.registry));
  for (const { pack, registry, custom } of entries.values()) {
    if (!custom) app.use(`/mcp/${encodeURIComponent(pack.name)}`, mcpRouter(pack, registry));
  }
  // Dynamic (browser-built) packs get their MCP route resolved at request time.
  app.use("/mcp/:packName", (req, res, next) => {
    const e = entries.get(req.params.packName);
    if (!e?.custom || !e.mcp) return next();
    e.mcp(req, res, next);
  });
  app.use(express.json({ limit: "1mb" }));

  // Permissive CORS so the embeddable widget works from any origin.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  app.get("/widget.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(widgetJs());
  });

  /** Resolve the target pack from ?pack= or body.pack; falls back to default. */
  function resolve(req: express.Request): PackEntry | undefined {
    evictExpired();
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
    evictExpired();
    res.json({
      dynamicEnabled,
      packs: Array.from(entries.values()).map(({ pack: p, custom }) => ({
        name: p.name,
        title: p.title || "",
        description: p.description || "",
        supervisor: p.supervisor.name,
        specialists: p.specialists.length,
        tools: p.tools.length,
        examples: p.examples || [],
        custom: Boolean(custom),
      })),
    });
  });

  app.get("/api/toolcatalog", (_req, res) => {
    res.json({
      tools: Array.from(toolCatalog.entries()).map(([name, { tool, source }]) => ({
        name,
        description: tool.schema.description,
        category: tool.category || "tool",
        source,
      })),
    });
  });

  // AI-assisted builder: turn a plain-English description into a full team
  // spec (name, specialists, prompts, tool picks from the catalog).
  const suggestLimiter = rateLimit(Number(process.env.AGENTPACK_SUGGEST_LIMIT ?? 10));
  app.post("/api/suggest", suggestLimiter, async (req, res) => {
    if (!dynamicEnabled) {
      res.status(403).json({ error: "dynamic packs are disabled on this server" });
      return;
    }
    if (!hasLlmKey()) {
      res.status(503).json({ error: "no LLM key configured on this server" });
      return;
    }
    const description = String(req.body?.description || "").trim().slice(0, 1000);
    if (description.length < 8) {
      res.status(400).json({ error: "describe your agent in a sentence or two" });
      return;
    }
    const catalog = Array.from(toolCatalog.entries())
      .map(([name, { tool, source }]) => `- ${name} (from ${source}): ${tool.schema.description}`)
      .join("\n");
    const prompt = [
      "You design multi-agent teams. Given a user's description of the agent they want,",
      "produce a team spec as pure JSON (no markdown fences, no commentary):",
      "{",
      '  "name": "short-kebab-case-name",',
      '  "description": "one sentence",',
      '  "supervisorInstructions": "one or two sentences of extra guidance for the supervisor (e.g. what the final answer must always include)",',
      '  "specialists": [',
      '    { "name": "kebab_or_snake_case", "description": "what the supervisor sees when delegating",',
      '      "prompt": "full system prompt for this specialist", "tools": ["tool_name"] }',
      "  ]",
      "}",
      "Rules:",
      "- 2 to 4 specialists with clearly distinct roles.",
      "- Only pick tools from the catalog below, and only ones genuinely relevant to the user's domain. A specialist may have zero tools if its role is pure writing/synthesis.",
      "- If NO catalog tools fit the domain, still build the team with empty tool lists and prompts that work from reasoning alone.",
      "- Specialist prompts must instruct: search/act immediately with whatever criteria were given (all filters optional), report every field the tools return, never ask the user for more information, and be honest when data is unavailable.",
      "",
      "Tool catalog:",
      catalog,
      "",
      "User's description of the agent they want:",
      description,
    ].join("\n");
    try {
      const out = await makeModel().invoke(prompt);
      const text = typeof out.content === "string"
        ? out.content
        : (out.content as any[]).map((c) => c?.text || "").join("");
      // Models sometimes wrap JSON in fences or prose — extract the outermost object.
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error(`no JSON in model output: ${text.slice(0, 200)}`);
      const raw = JSON.parse(text.slice(start, end + 1));
      // Sanitize: never trust model output blindly.
      const specialists = (Array.isArray(raw.specialists) ? raw.specialists : [])
        .slice(0, 6)
        .map((s: any) => ({
          name: String(s?.name || "specialist").slice(0, 40),
          description: String(s?.description || "").slice(0, 300),
          prompt: String(s?.prompt || "").slice(0, 2000),
          tools: (Array.isArray(s?.tools) ? s.tools : [])
            .filter((t: any) => typeof t === "string" && toolCatalog.has(t)),
        }))
        .filter((s: any) => s.description && s.prompt);
      if (!specialists.length) {
        res.status(502).json({ error: "the model returned an unusable spec — try rephrasing your description" });
        return;
      }
      res.json({
        name: String(raw.name || "my-agent").slice(0, 40),
        description: String(raw.description || description).slice(0, 200),
        supervisorInstructions: String(raw.supervisorInstructions || "").slice(0, 500),
        specialists,
      });
    } catch (e: any) {
      console.error("[agentpack] /api/suggest failed:", e?.message || e);
      res.status(502).json({ error: "could not generate a team spec — try rephrasing your description" });
    }
  });

  const buildLimiter = rateLimit(Number(process.env.AGENTPACK_BUILD_LIMIT ?? 10));
  app.post("/api/packs", buildLimiter, (req, res) => {
    if (!dynamicEnabled) {
      res.status(403).json({ error: "dynamic packs are disabled on this server" });
      return;
    }
    const b = req.body || {};
    const problems: string[] = [];
    // Normalize human input ("San Antonio Trip" → "san-antonio-trip") instead of rejecting it.
    const slugify = (s: unknown) => String(s ?? "").trim().toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 40);
    const slug = (s: unknown) => /^[a-z0-9][a-z0-9-_]{1,39}$/.test(slugify(s));

    if (!slug(b.name)) problems.push("name must contain at least 2 letters or digits");
    if (!Array.isArray(b.specialists) || b.specialists.length === 0) problems.push("at least one specialist required");
    if (Array.isArray(b.specialists) && b.specialists.length > 8) problems.push("max 8 specialists");

    const specialists = (Array.isArray(b.specialists) ? b.specialists : []).map((s: any, i: number) => {
      if (!slug(s?.name)) problems.push(`specialist ${i + 1}: invalid name`);
      if (typeof s?.description !== "string" || !s.description.trim() || s.description.length > 300) {
        problems.push(`specialist ${i + 1}: description required (max 300 chars)`);
      }
      if (typeof s?.prompt !== "string" || !s.prompt.trim() || s.prompt.length > 4000) {
        problems.push(`specialist ${i + 1}: prompt required (max 4000 chars)`);
      }
      const tools: string[] = Array.isArray(s?.tools) ? s.tools : [];
      for (const t of tools) {
        if (!toolCatalog.has(t)) problems.push(`specialist ${i + 1}: unknown tool "${t}"`);
      }
      return {
        name: slugify(s?.name),
        description: String(s?.description || "").trim(),
        prompt: String(s?.prompt || "").trim(),
        tools,
        approval: Boolean(s?.approval),
      };
    });

    if (problems.length) {
      res.status(400).json({ error: "invalid team", problems });
      return;
    }

    evictExpired();
    if (Array.from(entries.values()).filter((e) => e.custom).length >= DYNAMIC_PACK_MAX) {
      // evict the oldest custom pack
      const oldest = Array.from(entries.entries())
        .filter(([, e]) => e.custom)
        .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))[0];
      if (oldest) {
        entries.delete(oldest[0]);
        fs.rmSync(path.join(DATA_DIR, `${oldest[0]}.json`), { force: true });
      }
    }

    const spec: CustomPackSpec = {
      name: slugify(b.name),
      // The user's original (pre-slug) name makes a natural display title.
      title: typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 60)
        : String(b.name).trim() !== slugify(b.name) ? String(b.name).trim().slice(0, 60) : undefined,
      description: typeof b.description === "string" && b.description.trim() ? b.description.slice(0, 200) : undefined,
      supervisorName: slug(b.supervisor?.name) ? slugify(b.supervisor.name) : "supervisor",
      supervisorInstructions: typeof b.supervisor?.instructions === "string" && b.supervisor.instructions.trim()
        ? b.supervisor.instructions.trim().slice(0, 2000)
        : undefined,
      specialists,
      createdAt: Date.now(),
    };

    try {
      const name = registerCustomPack(spec, true);
      res.json({ ok: true, name, expiresInMinutes: DYNAMIC_PACK_TTL_MS / 60000 });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || String(e) });
    }
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

  app.post("/api/approve", (req, res) => {
    const { runId, approvalId, approve } = req.body || {};
    if (typeof runId !== "string" || typeof approvalId !== "string") {
      res.status(400).json({ error: "runId and approvalId required" });
      return;
    }
    const found = resolveApproval(runId, approvalId, Boolean(approve));
    if (!found) { res.status(404).json({ error: "no pending approval with that id" }); return; }
    res.json({ ok: true });
  });

  // SSE stream of run events. Primary path is /api/stream/:runId — the older
  // /events/:runId alias is kept for compatibility but ad-blocker filter lists
  // often block URLs containing "events", silently breaking the live UI.
  app.get(["/api/stream/:runId", "/events/:runId"], (req, res) => {
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
