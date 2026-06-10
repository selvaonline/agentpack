// agentpack — core types.
// A "pack" is a complete agent team: supervisor + specialists + tools.
// Tools are plain objects (schema + execute) — no imports from agentpack
// required, so tool files stay dependency-free and trivially testable.

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  default?: unknown;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolContext {
  runId?: string;
  /** Publish a progress event onto the run's SSE stream. */
  emit?: (kind: string, payload?: Record<string, unknown>) => void;
}

/** A tool implementation. Duck-typed: any object with schema + execute works. */
export interface AgentTool {
  schema: ToolSchema;
  category?: string;
  execute: (args: Record<string, any>, ctx: ToolContext) => Promise<any>;
}

/** One specialist agent: a named team member owning a subset of tools. */
export interface SpecialistSpec {
  name: string;
  /** What the supervisor sees when deciding to delegate. */
  description: string;
  /** The specialist's system prompt. */
  prompt: string;
  /** Tool names this specialist may call (must exist in the pack's tools). */
  tools: string[];
}

/** A complete agent team, ready to serve. */
export interface AgentPack {
  name: string;
  description?: string;
  supervisor: {
    name: string;
    prompt: string;
  };
  specialists: SpecialistSpec[];
  tools: AgentTool[];
}

/** {nodes, edges} topology for visualization. */
export interface NetworkTopology {
  nodes: Array<{ id: string; type: "supervisor" | "specialist" | "tool"; parent?: string }>;
  edges: Array<{ from: string; to: string }>;
}

export type Emit = (kind: string, payload?: Record<string, unknown>) => void;

/**
 * SSE event vocabulary — every orchestration engine that emits these events
 * drives the same dev UI and eval harness:
 *   run_started     { query }
 *   hop             { chain: string[], target, targetType: "supervisor"|"specialist"|"tool" }
 *   thinking        { text }
 *   tool_executing  { toolName, agent }
 *   tool_complete   { toolName, agent, durationMs, error? }
 *   agent_step      { hop, type: "delegate"|"tool_call"|"tool_result"|"finding", toolName?, content? }
 *   answer_chunk    { text }   (markdown)
 *   answer_complete {}
 *   run_finished    { ok }
 */
export const EVENT_KINDS = [
  "run_started", "hop", "thinking", "tool_executing", "tool_complete",
  "agent_step", "answer_chunk", "answer_complete", "run_finished",
] as const;
