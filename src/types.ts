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
  /** Human-in-the-loop: pause and ask the user before this specialist runs. */
  approval?: boolean;
}

/** A complete agent team, ready to serve. */
export interface AgentPack {
  name: string;
  /** Display name for the UI (e.g. "M&A Deal Agent"); defaults to a prettified name. */
  title?: string;
  description?: string;
  supervisor: {
    name: string;
    prompt: string;
  };
  specialists: SpecialistSpec[];
  tools: AgentTool[];
  /** Example prompts surfaced as clickable chips in the dev UI. */
  examples?: string[];
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
 *   approval_request  { approvalId, specialist, inquiry }  (run paused, awaiting user)
 *   approval_resolved { approvalId, approved }
 *   answer_token    { text }   (live token from the supervisor's final answer)
 *   answer_reset    {}         (the streamed segment was intermediate — discard it)
 *   answer_chunk    { text }   (the complete markdown answer)
 *   answer_complete {}
 *   usage           { inputTokens, outputTokens }  (cumulative across the run)
 *   run_finished    { ok }
 */
export const EVENT_KINDS = [
  "run_started", "hop", "thinking", "tool_executing", "tool_complete",
  "agent_step", "approval_request", "approval_resolved",
  "answer_token", "answer_reset", "answer_chunk", "answer_complete",
  "usage", "run_finished",
] as const;
