// agentpack — public API.
// Use the CLI (agentpack init / dev / eval) or embed programmatically:
//
//   import { loadManifest, createServer } from "@selvaonline/agentpack";
//   const pack = await loadManifest("./agentpack.yaml");
//   const { app } = createServer(pack);
//   app.listen(3000);

export type {
  AgentPack, AgentTool, SpecialistSpec, ToolSchema, ToolParameter,
  ToolContext, NetworkTopology, Emit,
} from "./types.js";
export { EVENT_KINDS } from "./types.js";
export { ToolRegistry, buildRegistry, networkTopology } from "./registry.js";
export { loadManifest, defaultSupervisorPrompt } from "./manifest.js";
export { createServer, type AgentpackServer } from "./server.js";
export { runSupervisor } from "./supervisor.js";
export { runEvals, type EvalCase } from "./evals.js";
export { makeModel, makeSupervisorModel, hasLlmKey } from "./llm.js";
export { jsonSchemaToZod } from "./jsonSchemaToZod.js";
export { publish, subscribe } from "./events.js";
