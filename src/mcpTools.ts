// agentpack — consume remote MCP servers as tool sources.
// Manifest syntax:
//   tools:
//     - ./tools                      # local modules
//     - mcp:https://host/mcp        # every tool on a remote MCP server
// Tools are discovered via tools/list at load time and proxied through a
// persistent Streamable HTTP client connection.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AgentTool } from "./types.js";

export function isMcpSource(entry: string): boolean {
  return /^mcp:/i.test(entry.trim());
}

export async function loadMcpTools(source: string): Promise<AgentTool[]> {
  const url = source.trim().replace(/^mcp:/i, "");
  let client: Client;
  try {
    client = new Client({ name: "agentpack", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  } catch (e: any) {
    throw new Error(`[agentpack] could not connect to MCP server ${url}: ${e?.message || e}`);
  }
  const { tools } = await client.listTools();
  return tools.map((t): AgentTool => ({
    category: "mcp",
    schema: {
      name: t.name,
      description: t.description || t.name,
      parameters: {
        type: "object",
        properties: ((t.inputSchema as any)?.properties || {}) as any,
        required: ((t.inputSchema as any)?.required || []) as string[],
      },
    },
    execute: async (args) => {
      const result: any = await client.callTool({ name: t.name, arguments: args });
      if (result?.isError) {
        const msg = (result.content || []).map((c: any) => c.text).join("\n");
        throw new Error(msg || `MCP tool ${t.name} failed`);
      }
      if (result?.structuredContent) return result.structuredContent;
      const text = (result?.content || [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      try { return JSON.parse(text); } catch { return text; }
    },
  }));
}
