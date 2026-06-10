#!/usr/bin/env node
// agentpack CLI — init / dev / eval
import fs from "node:fs";
import path from "node:path";
import { loadManifest } from "./manifest.js";
import { createServer } from "./server.js";
import { runEvals } from "./evals.js";
import { TEMPLATE_FILES } from "./template.js";

const [, , cmd, ...rest] = process.argv;

function arg(flag: string): string | undefined {
  const i = rest.indexOf(flag);
  return i >= 0 ? rest[i + 1] : undefined;
}

function positional(): string | undefined {
  return rest.find((a) => !a.startsWith("--") && rest[rest.indexOf(a) - 1]?.startsWith("--") !== true);
}

async function main() {
  switch (cmd) {
    case "init": {
      const dir = path.resolve(rest[0] && !rest[0].startsWith("--") ? rest[0] : "my-agent-team");
      if (fs.existsSync(path.join(dir, "agentpack.yaml"))) {
        console.error(`agentpack.yaml already exists in ${dir}`);
        process.exit(1);
      }
      for (const [rel, contents] of Object.entries(TEMPLATE_FILES)) {
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
      }
      console.log(`✓ Created agent team in ${dir}
`);
      console.log(`Next steps:
  cd ${path.relative(process.cwd(), dir) || "."}
  cp .env.example .env     # add one LLM key (OpenAI / Gemini / Groq)
  npx agentpack dev        # live network UI on http://localhost:3000`);
      break;
    }

    case "dev": {
      const manifest = rest.find((a) => !a.startsWith("--")) || "agentpack.yaml";
      loadDotEnv(path.dirname(path.resolve(manifest)));
      const pack = await loadManifest(manifest);
      const { app, registry } = createServer(pack);
      const port = Number(arg("--port") || process.env.PORT || 3000);
      app.listen(port, () => {
        console.log(`
⚡ agentpack — "${pack.name}"
   ${pack.specialists.length} specialists · ${registry.size} tools · supervisor: ${pack.supervisor.name}

   Dev UI      http://localhost:${port}
   MCP server  http://localhost:${port}/mcp
   API         POST http://localhost:${port}/api/run
`);
      });
      break;
    }

    case "eval": {
      const cases = rest.find((a) => !a.startsWith("--")) || "evals/cases.json";
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
  agentpack init [dir]                   scaffold a working example team
  agentpack dev [agentpack.yaml]         run the team: dev UI, MCP server, API
      --port <n>                         (default 3000)
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
