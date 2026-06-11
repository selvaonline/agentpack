// agentpack — AI project scaffolder behind `agentpack init --describe "..."`.
// One sentence in, a complete runnable project out: manifest, specialist
// prompts, tool stubs with realistic sample data, and behavioral eval cases.
import { makeModel } from "./llm.js";
import { defaultSupervisorPrompt } from "./manifest.js";

interface GeneratedTool {
  name: string;
  description: string;
  category: string;
  parameters: { type: "object"; properties: Record<string, any>; required?: string[] };
  /** Realistic example payload the stub returns until a real integration is wired in. */
  sampleResult: unknown;
}

interface GeneratedSpec {
  name: string;
  title: string;
  description: string;
  examples: string[];
  supervisorInstructions?: string;
  specialists: Array<{ name: string; description: string; prompt: string; tools: string[] }>;
  tools: GeneratedTool[];
  evals: Array<{ name: string; query: string; expect_specialists?: string[]; expect_keywords?: string[]; expect_no_delegation?: boolean }>;
}

/** Files of the generated project, keyed by relative path. */
export type ProjectFiles = Record<string, string>;

const slug = (s: string) =>
  String(s || "").trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "").slice(0, 40) || "my-agent";

const snake = (s: string) => slug(s).replace(/-/g, "_");

export async function generateProject(description: string): Promise<{ name: string; files: ProjectFiles }> {
  const prompt = [
    "You design multi-agent AI teams. Given a description, produce a complete team spec as pure JSON",
    "(no markdown fences, no commentary) with this exact shape:",
    "{",
    '  "name": "short-kebab-case-name",',
    '  "title": "Display Name For The UI",',
    '  "description": "one sentence",',
    '  "examples": ["three example user queries this team handles well", "...", "..."],',
    '  "supervisorInstructions": "one or two sentences of extra guidance, e.g. what the final answer must always include",',
    '  "specialists": [',
    '    { "name": "snake_case", "description": "what the supervisor sees when delegating",',
    '      "prompt": "full system prompt for this specialist", "tools": ["tool_name"] }',
    "  ],",
    '  "tools": [',
    '    { "name": "snake_case", "description": "what it does", "category": "research|analysis|scoring|data",',
    '      "parameters": { "type": "object", "properties": { "<arg>": { "type": "string", "description": "..." } }, "required": [] },',
    '      "sampleResult": { } }',
    "  ],",
    '  "evals": [',
    '    { "name": "routing_<x>", "query": "a realistic user query", "expect_specialists": ["specialist_name"], "expect_keywords": ["a word certain to appear in a good answer"] },',
    '    { "name": "honesty_refusal", "query": "an off-topic request this team must refuse", "expect_no_delegation": true }',
    "  ]",
    "}",
    "Rules:",
    "- 2 to 4 specialists with clearly distinct roles; the last may be a pure writer/synthesizer with no tools.",
    "- 2 to 5 tools. Every tool listed by a specialist must exist in \"tools\". Parameters should be simple (strings/numbers, mostly optional).",
    "- sampleResult must be a small but REALISTIC payload (2-3 records with plausible names and numbers) that a real implementation of this tool would return.",
    "- Specialist prompts must instruct: act immediately with whatever criteria were given (all filters optional), report every field the tools return, never ask the user for more information, and be honest when data is unavailable.",
    "- 3 to 4 eval cases: at least one routing case per specialist that has tools, and exactly one refusal case.",
    "",
    "Description of the team to build:",
    description,
  ].join("\n");

  const out = await makeModel().invoke(prompt);
  const text = typeof out.content === "string"
    ? out.content
    : (out.content as any[]).map((c) => c?.text || "").join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no JSON — try rephrasing the description");
  const spec = JSON.parse(text.slice(start, end + 1)) as GeneratedSpec;

  const name = slug(spec.name);
  const toolNames = new Set((spec.tools || []).map((t) => snake(t.name)));
  const specialists = (spec.specialists || []).slice(0, 4).map((s) => ({
    name: snake(s.name),
    description: String(s.description || "").trim(),
    prompt: String(s.prompt || "").trim(),
    tools: (s.tools || []).map(snake).filter((t) => toolNames.has(t)),
  }));
  if (!specialists.length || !specialists.every((s) => s.description && s.prompt)) {
    throw new Error("model returned an unusable spec — try rephrasing the description");
  }

  const files: ProjectFiles = {};

  // ── agentpack.yaml ─────────────────────────────────────────────────────────
  const y: string[] = [
    `name: ${name}`,
    `title: ${JSON.stringify(spec.title || name)}`,
    `description: ${JSON.stringify(spec.description || description)}`,
    "",
    "supervisor:",
    "  prompt: ./prompts/supervisor.md",
    "",
    "specialists:",
  ];
  for (const s of specialists) {
    y.push(`  - name: ${s.name}`);
    y.push(`    description: ${JSON.stringify(s.description)}`);
    y.push(`    prompt: ./prompts/${s.name}.md`);
    if (s.tools.length) y.push(`    tools: [${s.tools.join(", ")}]`);
  }
  y.push("", "tools: ./tools", "");
  if (Array.isArray(spec.examples) && spec.examples.length) {
    y.push("examples:");
    for (const e of spec.examples.slice(0, 4)) y.push(`  - ${JSON.stringify(e)}`);
    y.push("");
  }
  y.push(
    "# Anti-rationalization guardrails: built-in defaults always apply;",
    "# add domain-specific excuse/rebuttal pairs here.",
    "# guardrails:",
    '#   - excuse: "This metric is an estimate, so I should not quote it"',
    '#     rebuttal: "Quote it and label it as an estimate."',
    ""
  );
  files["agentpack.yaml"] = y.join("\n");

  // ── prompts ────────────────────────────────────────────────────────────────
  let supPrompt = defaultSupervisorPrompt("supervisor", specialists.map((s) => ({ ...s, approval: false })));
  if (spec.supervisorInstructions) supPrompt += `\n\nAdditional instructions:\n${spec.supervisorInstructions.trim()}`;
  files["prompts/supervisor.md"] = supPrompt + "\n";
  for (const s of specialists) files[`prompts/${s.name}.md`] = s.prompt + "\n";

  // ── tool stubs ─────────────────────────────────────────────────────────────
  const toolSrc: string[] = [
    "// Generated tool stubs — each returns realistic sample data so the team",
    "// runs end-to-end immediately. Replace execute() bodies with your real",
    "// data sources (APIs, databases, files); schemas can stay as they are.",
    "",
  ];
  for (const t of spec.tools || []) {
    const tn = snake(t.name);
    toolSrc.push(`export const ${tn} = {`);
    toolSrc.push(`  category: ${JSON.stringify(t.category || "tool")},`);
    toolSrc.push(`  schema: {`);
    toolSrc.push(`    name: ${JSON.stringify(tn)},`);
    toolSrc.push(`    description: ${JSON.stringify(t.description || tn)},`);
    toolSrc.push(`    parameters: ${JSON.stringify(t.parameters || { type: "object", properties: {} }, null, 2).replace(/\n/g, "\n    ")},`);
    toolSrc.push(`  },`);
    toolSrc.push(`  // TODO: replace with your real integration.`);
    toolSrc.push(`  execute: async (args: Record<string, unknown>) => ({`);
    toolSrc.push(`    note: "sample data from the generated stub — wire up a real source in tools/generated.ts",`);
    toolSrc.push(`    query: args,`);
    toolSrc.push(`    result: ${JSON.stringify(t.sampleResult ?? {}, null, 2).replace(/\n/g, "\n    ")},`);
    toolSrc.push(`  }),`);
    toolSrc.push(`};`, "");
  }
  files["tools/generated.ts"] = toolSrc.join("\n");

  // ── evals ──────────────────────────────────────────────────────────────────
  const specNames = new Set(specialists.map((s) => s.name));
  const cases = (spec.evals || [])
    .filter((c) => c?.name && c?.query)
    .map((c) => ({
      ...c,
      expect_specialists: c.expect_specialists?.map(snake).filter((s) => specNames.has(s)),
      budget_s: 120,
    }));
  files["evals/cases.json"] = JSON.stringify(
    { comment: "Behavioral evals — run with: npx agentpack eval (server must be running)", cases },
    null, 2
  ) + "\n";

  // ── env + readme ───────────────────────────────────────────────────────────
  files[".env.example"] = "OPENAI_API_KEY=\nGEMINI_API_KEY=\nGROQ_API_KEY=\n";
  files["README.md"] = `# ${spec.title || name}

${spec.description || description}

Generated by \`agentpack init --describe\`. The tools in \`tools/generated.ts\`
return realistic sample data so the team runs end-to-end immediately — replace
their \`execute()\` bodies with real data sources when ready.

## Run it

\`\`\`bash
npm install
cp .env.example .env   # add one LLM key (OpenAI / Gemini / Groq)
npm run dev            # live network UI on http://localhost:3000
npm run eval           # behavioral evals (server must be running)
\`\`\`
`;

  return { name, files };
}
