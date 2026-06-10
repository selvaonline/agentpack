// agentpack — auto-generated MCP server (Streamable HTTP).
// Every tool in the registry is exposed over Model Context Protocol with
// schemas derived from the tool's own JSON Schema — never hand-written.
import { Router, json } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AgentPack } from "./types.js";
import type { ToolRegistry } from "./registry.js";
import { jsonSchemaToZod } from "./jsonSchemaToZod.js";

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
}

export function mcpRouter(pack: AgentPack, registry: ToolRegistry): Router {
  const sessions = new Map<string, McpSession>();

  setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [id, s] of sessions) {
      if (s.createdAt < cutoff) {
        s.transport.close().catch(() => {});
        s.server.close().catch(() => {});
        sessions.delete(id);
      }
    }
  }, 30 * 60 * 1000).unref?.();

  function createSession(): McpSession {
    const server = new McpServer(
      { name: pack.name, version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    for (const reg of registry.list()) {
      server.tool(
        reg.schema.name,
        reg.schema.description,
        jsonSchemaToZod(reg.schema.parameters).shape,
        async (args: Record<string, any>) => {
          const clean = Object.fromEntries(
            Object.entries(args || {}).filter(([, v]) => v !== null && v !== undefined)
          );
          const result = await reg.execute(clean, {});
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        }
      );
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    return { transport, server, createdAt: Date.now() };
  }

  const router = Router();
  router.use(json());

  router.post("/", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res, req.body);
      return;
    }
    const session = createSession();
    await session.server.connect(session.transport);
    await session.transport.handleRequest(req, res, req.body);
    const sid = session.transport.sessionId;
    if (sid) sessions.set(sid, session);
  });

  router.get("/", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
      return;
    }
    res.json({
      name: `${pack.name} (agentpack MCP server)`,
      protocol: "Model Context Protocol (Streamable HTTP)",
      tools: registry.list().map((t) => t.schema.name),
      toolCount: registry.size,
      connect: { example: { mcpServers: { [pack.name]: { url: "<this-url>" } } } },
    });
  });

  router.delete("/", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    await session.transport.close();
    await session.server.close();
    sessions.delete(sessionId);
  });

  return router;
}
