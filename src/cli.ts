#!/usr/bin/env node
// agentpack CLI — init / templates / dev / eval
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { loadManifest } from "./manifest.js";
import { createServer } from "./server.js";
import { runEvals } from "./evals.js";

const [, , cmd, ...rest] = process.argv;

// Works from dist/cli.js (npm install) and src/cli.ts (repo dev) alike.
const TEMPLATES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates");

function arg(flag: string): string | undefined {
  const i = rest.indexOf(flag);
  return i >= 0 ? rest[i + 1] : undefined;
}

function positionals(): string[] {
  const flagsWithValue = new Set(["--template", "--port", "--api-url", "--only", "--skip"]);
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) {
      if (flagsWithValue.has(rest[i])) i++;
      continue;
    }
    out.push(rest[i]);
  }
  return out;
}

function listTemplates(): Array<{ id: string; name: string; description: string }> {
  return fs.readdirSync(TEMPLATES_ROOT)
    .filter((d) => fs.existsSync(path.join(TEMPLATES_ROOT, d, "agentpack.yaml")))
    .map((d) => {
      const m = parseYaml(fs.readFileSync(path.join(TEMPLATES_ROOT, d, "agentpack.yaml"), "utf-8"));
      return { id: d, name: m.name || d, description: m.description || "" };
    });
}

async function main() {
  switch (cmd) {
    case "templates": {
      console.log("Available templates (agentpack init <dir> --template <id>):\n");
      for (const t of listTemplates()) {
        console.log(`  ${t.id.padEnd(18)} ${t.description}`);
      }
      break;
    }

    case "init": {
      const dir = path.resolve(positionals()[0] || "my-agent-team");
      const template = arg("--template") || "starter";
      const src = path.join(TEMPLATES_ROOT, template);
      if (!fs.existsSync(path.join(src, "agentpack.yaml"))) {
        console.error(`Unknown template "${template}". Available: ${listTemplates().map((t) => t.id).join(", ")}`);
        process.exit(1);
      }
      if (fs.existsSync(path.join(dir, "agentpack.yaml"))) {
        console.error(`agentpack.yaml already exists in ${dir}`);
        process.exit(1);
      }
      fs.cpSync(src, dir, {
        recursive: true,
        // never copy real env files or local artifacts out of a template
        filter: (p) => {
          const base = path.basename(p);
          return base !== "node_modules" && !(base.startsWith(".env") && base !== ".env.example");
        },
      });
      console.log(`✓ Created agent team in ${dir} (template: ${template})
`);
      console.log(`Next steps:
  cd ${path.relative(process.cwd(), dir) || "."}
  cp .env.example .env     # add one LLM key (OpenAI / Gemini / Groq)
  npx agentpack dev        # live network UI on http://localhost:3000`);
      break;
    }

    case "dev": {
      const manifests = positionals().length ? positionals() : ["agentpack.yaml"];
      loadDotEnv(path.dirname(path.resolve(manifests[0])));
      const packs: Awaited<ReturnType<typeof loadManifest>>[] = [];
      for (const m of manifests) packs.push(await loadManifest(m));
      const { app } = createServer(packs);
      const port = Number(arg("--port") || process.env.PORT || 3000);
      app.listen(port, () => {
        const teams = packs
          .map((p) => `   • ${p.name} — ${p.specialists.length} specialists · ${p.tools.length} tools`)
          .join("\n");
        console.log(`
⚡ agentpack — serving ${packs.length} team${packs.length > 1 ? "s" : ""}
${teams}

   Dev UI      http://localhost:${port}
   MCP server  http://localhost:${port}/mcp${packs.length > 1 ? `  (per team: /mcp/<name>)` : ""}
   API         POST http://localhost:${port}/api/run
`);
      });
      break;
    }

    case "eval": {
      const cases = positionals()[0] || "evals/cases.json";
      loadDotEnv(process.cwd());
      const apiUrl = arg("--api-url") || `http://localhost:${process.env.PORT || 3000}`;
      const code = await runEvals(path.resolve(cases), apiUrl, {
        only: arg("--only"),
        skip: rest.filter((a, i) => rest[i - 1] === "--skip"),
      });
      process.exit(code);
    }

    default:
      console.log(`agentpack — define your agent team in YAML, get a supervisor + live UI + MCP server + evals

Usage:
  agentpack init [dir] --template <id>   scaffold a team (default template: starter)
  agentpack templates                    list available templates
  agentpack dev [manifest...]            run one or more teams: dev UI, MCP, API
      --port <n>                         (default 3000; multiple manifests get a pack switcher)
  agentpack eval [evals/cases.json]      behavioral evals against a running server
      --api-url <url>  --only <case>  --skip <case>
`);
      process.exit(cmd && cmd !== "--help" && cmd !== "-h" ? 1 : 0);
  }
}

/** Minimal .env loader (no dependency): KEY=VALUE lines, no expansion. */
function loadDotEnv(dir: string) {
  const file = path.join(dir, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
