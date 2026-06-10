// agentpack — tool registry. Instance-based (no global state): every server
// owns its registry, built from the pack's tools at startup.
import type { AgentPack, AgentTool, NetworkTopology } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    const name = tool.schema?.name;
    if (!name) throw new Error("[agentpack] tool is missing schema.name");
    if (this.tools.has(name)) {
      console.warn(`[agentpack] tool "${name}" re-registered (overwriting)`);
    }
    this.tools.set(name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  get size(): number {
    return this.tools.size;
  }

  /** OpenAI function-calling format. */
  openAiTools(): Array<{ type: "function"; function: { name: string; description: string; parameters: any } }> {
    return this.list().map((t) => ({
      type: "function" as const,
      function: { name: t.schema.name, description: t.schema.description, parameters: t.schema.parameters },
    }));
  }
}

export function buildRegistry(pack: AgentPack): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of pack.tools) registry.register(tool);
  // Fail fast on dangling tool references.
  for (const s of pack.specialists) {
    for (const t of s.tools) {
      if (!registry.get(t)) {
        throw new Error(`[agentpack] specialist "${s.name}" references unknown tool "${t}"`);
      }
    }
  }
  return registry;
}

export function networkTopology(pack: AgentPack): NetworkTopology {
  const nodes: NetworkTopology["nodes"] = [{ id: pack.supervisor.name, type: "supervisor" }];
  const edges: NetworkTopology["edges"] = [];
  for (const s of pack.specialists) {
    nodes.push({ id: s.name, type: "specialist", parent: pack.supervisor.name });
    edges.push({ from: pack.supervisor.name, to: s.name });
    for (const t of s.tools) {
      nodes.push({ id: t, type: "tool", parent: s.name });
      edges.push({ from: s.name, to: t });
    }
  }
  return { nodes, edges };
}
