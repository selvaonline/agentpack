---
name: build-agent-team
description: Build, run, and test a multi-agent AI team with agentpack. Use when the user wants to create a multi-agent system, an AI agent team, a supervisor/specialist architecture, agents with tools, an MCP server for their agents, or behavioral evals for agents.
---

# Build a multi-agent team with agentpack

agentpack (`@selvaonline/agentpack`) turns one YAML manifest into a running
multi-agent team: a supervisor that delegates to specialist agents, each owning
a subset of tools, with a live network UI, an auto-generated MCP server,
streaming API, and a behavioral eval harness.

## Fastest path: AI-generate the project

```bash
npx @selvaonline/agentpack init --describe "<one or two sentences describing the team>"
cd <generated-dir>
npm install
cp .env.example .env   # add OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY
npm run dev            # UI at http://localhost:3000
```

This generates the manifest, specialist prompts, tool stubs with realistic
sample data (the team runs end-to-end immediately), and eval cases. Replace the
`execute()` bodies in `tools/generated.ts` with real data sources.

Alternatively scaffold from a curated template: `npx @selvaonline/agentpack init <dir> --template <id>`
(list ids with `npx @selvaonline/agentpack templates` — includes deal-ma, equity-research, claims-triage, support-triage, starter).

## Manifest anatomy (agentpack.yaml)

```yaml
name: my-team                # slug
title: "My Team"             # UI display name
description: "One sentence."
supervisor:
  prompt: ./prompts/supervisor.md   # optional — a strong default is generated
specialists:
  - name: researcher
    description: "What the supervisor sees when deciding to delegate."
    prompt: ./prompts/researcher.md  # or inline text
    tools: [search_things]           # names of tools this specialist may call
    approval: false                  # true = human must approve each delegation
tools: ./tools               # directory of TS/JS modules; also: "mcp:https://host/mcp"
examples:
  - "Example query shown as a clickable chip in the UI"
guardrails:                  # optional domain-specific anti-rationalization pairs
  - excuse: "This metric is an estimate, so I should not quote it"
    rebuttal: "Quote it and label it as an estimate."
```

## Tools are plain objects — no framework imports

```ts
export const search_things = {
  category: "research",
  schema: {
    name: "search_things",
    description: "What it does (the LLM reads this).",
    parameters: { type: "object", properties: { q: { type: "string" } }, required: [] },
  },
  execute: async (args: Record<string, unknown>) => ({ results: [] }),
};
```

## Prompt rules that make teams reliable

Specialist prompts must instruct: act immediately with whatever criteria were
given (all filters are optional), report every field the tools return, never
ask the user for more information, and be honest when data is unavailable.
Built-in anti-rationalization guardrails are appended to every prompt
automatically; add domain-specific pairs under `guardrails:`.

## Test it

Define cases in `evals/cases.json` (routing, completeness, refusal, tool
usage, optional LLM-as-judge), then with the dev server running:

```bash
npx @selvaonline/agentpack eval            # behavioral checks
npx @selvaonline/agentpack eval --judge    # + LLM-as-judge scoring
```

## Integrate

- REST: `POST /api/run` `{ query, pack?, threadId? }` → `{ runId }`; stream events from `GET /api/stream/:runId` (SSE) or poll `GET /api/runlog/:runId`.
- MCP: every team is an MCP server at `/mcp` (or `/mcp/<name>`); connect Claude/Cursor directly.
- Embed: `<script src="http://host/widget.js">` drops a live network panel into any page.

Docs: https://github.com/selvaonline/agentpack
