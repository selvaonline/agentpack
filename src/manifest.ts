// agentpack — agentpack.yaml manifest loader.
// The manifest is the framework's whole promise: one YAML file describes the
// team; prompts can live in markdown files; tools are plain TS/JS modules
// discovered from a directory (no agentpack import required in tool files).
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { AgentPack, AgentTool, SpecialistSpec } from "./types.js";

interface ManifestSpecialist {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
}

interface Manifest {
  name: string;
  /** Display name for the UI (e.g. "M&A Deal Agent"). */
  title?: string;
  description?: string;
  supervisor?: { name?: string; prompt?: string };
  specialists: ManifestSpecialist[];
  /** Directory or list of files containing tool modules. */
  tools?: string | string[];
  /** Example prompts shown as clickable chips in the dev UI. */
  examples?: string[];
}

/** Resolve a prompt field: inline text, or a relative path to a text file. */
function resolvePrompt(value: string, baseDir: string): string {
  const looksLikePath = /^\.{0,2}\//.test(value) || /\.(md|txt)$/i.test(value.trim());
  if (looksLikePath) {
    const p = path.resolve(baseDir, value.trim());
    if (!fs.existsSync(p)) throw new Error(`[agentpack] prompt file not found: ${p}`);
    return fs.readFileSync(p, "utf-8").trim();
  }
  return value.trim();
}

function isAgentTool(x: any): x is AgentTool {
  return x && typeof x === "object" && x.schema?.name && typeof x.execute === "function";
}

/** Import tool modules (TS or JS) and collect every exported AgentTool. */
async function loadTools(spec: string | string[] | undefined, baseDir: string): Promise<AgentTool[]> {
  if (!spec) return [];
  const files: string[] = [];
  const entries = Array.isArray(spec) ? spec : [spec];
  for (const entry of entries) {
    const p = path.resolve(baseDir, entry);
    if (!fs.existsSync(p)) throw new Error(`[agentpack] tools path not found: ${p}`);
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p)) {
        if (/\.(ts|mts|js|mjs)$/.test(f) && !f.endsWith(".d.ts") && !f.includes(".test.")) {
          files.push(path.join(p, f));
        }
      }
    } else {
      files.push(p);
    }
  }

  // tsx's tsImport lets us load user .ts tool files even from compiled JS.
  const { tsImport } = await import("tsx/esm/api");
  const tools: AgentTool[] = [];
  for (const file of files) {
    const mod = await tsImport(file, import.meta.url);
    for (const exported of Object.values(mod)) {
      if (isAgentTool(exported)) tools.push(exported);
      else if (Array.isArray(exported)) tools.push(...exported.filter(isAgentTool));
    }
  }
  return tools;
}

/** A sensible default supervisor prompt generated from the team itself. */
export function defaultSupervisorPrompt(name: string, specialists: SpecialistSpec[]): string {
  const team = specialists.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  return `You are ${name}, the supervisor of a team of specialist agents.

Your team (each is a tool you can call with an "inquiry" and optional "context"):
${team}

How you work:
1. Decompose the user's request into a checklist of every distinct part.
2. Call the relevant specialists in a sensible order. Pass each one the
   specific question plus concrete context from earlier specialists
   (include names, numbers, and identifiers verbatim).
3. Do NOT produce your final answer until every part of the checklist has
   been addressed by the corresponding specialist. If a specialist fails,
   note the failure and continue with the remaining parts.
3b. If the request gives only partial criteria, proceed with what was given —
   never ask the user follow-up questions when reasonable defaults exist.
   Tell specialists to search/act immediately with whatever criteria exist;
   all filters are optional. If a specialist asks for more filters, re-call
   it instructing it to proceed with the available criteria.
4. Your final answer must be a clear markdown report: one section per
   checklist part, including the specialists' concrete findings verbatim —
   never replace specifics with vague phrases. End with a conclusion or
   recommendation section.
5. Only answer questions related to your team's purpose. Politely decline
   anything else without calling any specialist.

Never fabricate data. If a specialist returns an error or empty result,
report that honestly.`;
}

/** Load and validate an agentpack.yaml into a runnable AgentPack. */
export async function loadManifest(manifestPath: string): Promise<AgentPack> {
  const file = path.resolve(manifestPath);
  if (!fs.existsSync(file)) throw new Error(`[agentpack] manifest not found: ${file}`);
  const baseDir = path.dirname(file);
  const m = parseYaml(fs.readFileSync(file, "utf-8")) as Manifest;

  if (!m?.name) throw new Error("[agentpack] manifest needs a 'name'");
  if (!Array.isArray(m.specialists) || m.specialists.length === 0) {
    throw new Error("[agentpack] manifest needs at least one specialist");
  }

  const specialists: SpecialistSpec[] = m.specialists.map((s) => {
    if (!s.name || !s.description || !s.prompt) {
      throw new Error(`[agentpack] specialist "${s.name || "?"}" needs name, description, and prompt`);
    }
    return {
      name: s.name,
      description: s.description,
      prompt: resolvePrompt(s.prompt, baseDir),
      tools: s.tools || [],
    };
  });

  const supervisorName = m.supervisor?.name || "supervisor";
  const supervisorPrompt = m.supervisor?.prompt
    ? resolvePrompt(m.supervisor.prompt, baseDir)
    : defaultSupervisorPrompt(supervisorName, specialists);

  const tools = await loadTools(m.tools, baseDir);

  return {
    name: m.name,
    title: typeof m.title === "string" ? m.title : undefined,
    description: m.description,
    supervisor: { name: supervisorName, prompt: supervisorPrompt },
    specialists,
    tools,
    examples: Array.isArray(m.examples) ? m.examples.filter((e) => typeof e === "string") : undefined,
  };
}
