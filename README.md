# ⚡ agentpack

**Define your AI agent team in one YAML file. Get a multi-agent supervisor, a live network UI, an MCP server, and a behavioral eval harness — out of the box. TypeScript.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![Built on LangGraph.js](https://img.shields.io/badge/orchestration-LangGraph.js-blue)](https://langchain-ai.github.io/langgraphjs/)

![agentpack dev UI — live agent network during a run](docs/assets/ui-live.png)

*The built-in dev UI during a live run: switch between teams, click an example prompt, and watch the supervisor delegate across the network — animated dotted connectors trace every delegation, tools glow as they execute, every hop is streamed and counted. You write none of this.*

---

## Why

Multi-agent frameworks give you orchestration primitives and a blank screen. Everything that makes an agent team *demoable, debuggable, and trustworthy* — a UI that shows who's doing what, an MCP server so other agents can call your tools, evals that prove the team behaves — you build yourself, every time.

**agentpack inverts that.** The orchestration engine (LangGraph.js) is the boring part. The batteries are the product:

| You write | You get for free |
|---|---|
| `agentpack.yaml` — the team | LangGraph supervisor with delegation, retries, conversation memory |
| Prompts — markdown files | Live agent-network dev UI with hop-by-hop animation (SSE) |
| Tools — plain TS objects | Auto-generated MCP server (every tool, schemas derived, zero wrappers) |
| Eval cases — JSON | Behavioral eval harness: routing, completeness, refusal, latency budgets |

**Live demo:** [agentpack.selvaonline.com](https://agentpack.selvaonline.com) — the `deal-ma` template running on AWS: ask it to evaluate an acquisition and watch the six-agent network work. Its MCP server is public too: `https://agentpack.selvaonline.com/mcp`.

## Five minutes to a running team

```bash
npx @selvaonline/agentpack init my-team
cd my-team
cp .env.example .env        # add ONE key: OpenAI, Gemini, or Groq
npx agentpack dev           # → http://localhost:3000
```

You now have a working travel-planning team — a supervisor delegating to a destination scout, a budget planner, and an itinerary writer over deterministic demo tools. Ask it:

> *Plan a 5-day trip to Japan in spring on a $3000 budget: research the destination, estimate the costs, and write a day-by-day itinerary.*

Then prove it behaves:

```bash
npx agentpack eval          # routing / completeness / refusal — against the live server
```

```text
PASS routing_budget          agents=["budget_planner"] tools={"estimate_costs":1}
PASS completeness_full_plan  agents=["destination_scout","budget_planner","itinerary_writer"]
PASS honesty_refusal         agents=[]  (off-topic request: no delegation, polite decline)
```

## Templates: a full deal team in one command

The starter team is a toy. The deal templates are the product — the same six-role deal lifecycle (**scout → risk → market → financial modeler → portfolio manager → deal writer**) instantiated for three industries:

```bash
npx agentpack templates                          # list available templates
npx agentpack init my-fund   --template deal-vc
npx agentpack init acquisitions --template deal-ma
npx agentpack init sourcing  --template deal-procurement
```

| Template | Team | Tools (deterministic demo data — swap for your APIs) |
|---|---|---|
| `deal-ma` | M&A acquisition team | target screening, weighted risk scoring, sector multiples, **real DCF math**, portfolio fit |
| `deal-vc` | VC investment team | deal-flow sourcing, founder/market risk, **TAM/SAM/SOM + dilution math**, fund-thesis fit |
| `deal-procurement` | Procurement sourcing team | vendor search, supplier risk, category intel, **TCO modeling**, spend concentration |
| `starter` | Trip-planning team | the gentlest possible introduction |

![M&A deal team mid-run](docs/assets/deal-team-live.png)

*The `deal-ma` template mid-run: Deal Lead delegating across all six roles. Every template ships with its own eval suite — all three pass 9/9.*

### Reshape the team in seconds

The "agent categories" are pure configuration. Remove the portfolio manager? Delete its block from `agentpack.yaml`, restart — 2 seconds. Add an ESG analyst? Add a block, a prompt file, and a tool:

```yaml
  - name: esg_analyst
    description: Screens deals for ESG red flags and reporting obligations.
    prompt: ./prompts/esg_analyst.md
    tools: [esg_screen]
```

The supervisor, the network UI, the MCP server, and the eval harness all pick up the new topology automatically — no code changes anywhere.

## The manifest is the framework

```yaml
# agentpack.yaml
name: trip-planner
title: Trip Planner Agent      # display name for the UI (optional)

supervisor:
  name: trip_advisor
  # prompt: ./prompts/supervisor.md   # optional — a disciplined default is generated

specialists:
  - name: destination_scout
    description: Researches destinations, attractions, and seasonal weather.
    prompt: ./prompts/destination_scout.md
    tools: [search_destinations, get_weather]

  - name: budget_planner
    description: Estimates trip costs and builds budget breakdowns.
    prompt: ./prompts/budget_planner.md
    tools: [estimate_costs]

tools: ./tools        # directory of plain TS/JS modules — auto-discovered
```

Tools are **dependency-free duck-typed objects** — no imports from agentpack, trivially unit-testable, reusable anywhere:

```typescript
// tools/budget.ts
export const estimateCosts = {
  schema: {
    name: "estimate_costs",
    description: "Estimate total trip cost by region and travel style.",
    parameters: {
      type: "object" as const,
      properties: {
        region: { type: "string", description: "Asia | Europe | ..." },
        days: { type: "number", description: "Trip length in days" },
      },
      required: ["region", "days"],
    },
  },
  async execute({ region, days }) {
    return { totalPerPerson: /* deterministic math, zero LLM tokens */ };
  },
};
```

Edit the YAML, restart. That's the whole iteration loop.

## What `agentpack dev` serves

| Endpoint | What it does |
|---|---|
| `GET /` | Dev UI — live network graph, hop animation, event feed, markdown answers |
| `POST /api/run` | Run a query (`{ query, threadId? }` → `{ runId }`); follow-ups on the same `threadId` keep conversation memory |
| `GET /events/:runId` | SSE stream — a clean 9-event vocabulary (`hop`, `tool_executing`, `agent_step`, `answer_chunk`, …) |
| `GET /api/network` | `{nodes, edges}` team topology |
| `GET /api/tools` · `POST /api/tools/execute` | Inspect and call any tool directly — **zero tokens**, deterministic, golden-testable |
| `GET /api/toolcatalog` · `POST /api/packs` | Tool catalog + **build-your-own teams**: compose a new team from loaded tools at runtime, no restart |
| `ALL /mcp` | **Auto-generated MCP server** (Streamable HTTP) — connect Claude, Cursor, or any MCP client to your team's tools |

Connect from Cursor or Claude Desktop:

```json
{ "mcpServers": { "trip-planner": { "url": "http://localhost:3000/mcp" } } }
```

### Build a team in the browser — no code

The dev UI ships with a **＋ Build your own** tab: name your team, define specialists
(name, role, system prompt), assign them tools picked from the catalog of everything
the server has loaded, and hit **Launch** — the team goes live instantly with the full
network view, its own MCP endpoint at `/mcp/<name>`, and conversation memory.
One click exports your design as a ready-to-run `agentpack.yaml`.

Browser-built teams are ephemeral (they expire after ~2 hours) and compose *existing*
tools only. For custom tools and a permanent setup, scaffold a project with
`npx agentpack init` — or disable the feature entirely with `AGENTPACK_DYNAMIC=0`.

## Evals as a first-class citizen

`evals/cases.json` declares behavioral expectations; the harness drives the real server through the same SSE contract the UI uses — so a green suite means the *full stack* works:

```json
{
  "name": "completeness_full_plan",
  "query": "Plan a 5-day trip to Japan in spring on a $3000 budget...",
  "expect_specialists": ["destination_scout", "budget_planner", "itinerary_writer"],
  "expect_keywords": ["day"],
  "budget_s": 240
}
```

Checks available per case: `expect_specialists` / `min_specialists` (routing), `expect_keywords` / `expect_any_keywords` (completeness), `expect_no_delegation` (refusal/honesty), `min_tool_calls` (tool usage), `budget_s` (latency — warn at 1×, fail at 2×).

## Embed it programmatically

```typescript
import { loadManifest, createServer } from "@selvaonline/agentpack";

const pack = await loadManifest("./agentpack.yaml");
const { app, registry } = createServer(pack);   // an Express app — mount or extend it
app.listen(3000);
```

Or skip YAML entirely and build the `AgentPack` object in code — the manifest is sugar, not a requirement.

## Design principles

1. **One runtime.** No sidecar servers, no HTTP bridges between your tools and your agents. Everything runs in-process in Node.
2. **Plain config.** YAML + markdown + JSON Schema. No bespoke config languages.
3. **Tools are deterministic, LLMs decide.** Tools take typed args and return JSON — testable with golden tests, callable for zero tokens via API/MCP. The LLM's only job is orchestration and synthesis.
4. **Glass box by default.** If you can't watch the delegation happen, you can't debug it and you can't demo it.
5. **Evals or it didn't happen.** A team you can't test is a liability. The harness ships in the box, not as homework.

## A production example

**[DealSense](https://github.com/selvaonline/realestate-ai-agent)** — a commercial real estate deal-intelligence platform (multi-agent underwriting, risk scoring, IC memos) — is the flagship application of this architecture, deployed on AWS at [reagent.selvaonline.com](https://reagent.selvaonline.com). agentpack is that platform's core, extracted and generalized.

## Project structure

```
src/
  types.ts            AgentPack / AgentTool / SpecialistSpec + event vocabulary
  manifest.ts         agentpack.yaml loader (prompts from files, tools auto-discovered)
  registry.ts         instance-based tool registry + topology
  supervisor.ts       generic LangGraph.js supervisor (delegation, memory, events)
  server.ts           Express factory: run API, SSE, tools API, dev UI, MCP
  mcp.ts              auto-generated MCP server from the registry
  devui.ts            zero-build live network UI
  evals.ts            behavioral eval harness
  cli.ts              agentpack init / templates / dev / eval
templates/
  starter/            trip-planning team — the gentle introduction
  deal-ma/            M&A acquisition team (6 roles, 7 tools, evals)
  deal-vc/            VC investment team (6 roles, 6 tools, evals)
  deal-procurement/   procurement sourcing team (6 roles, 5 tools, evals)
```

## Roadmap

- [ ] More vertical templates (equity research, insurance underwriting, claims triage)
- [ ] `agentpack eval --judge` — LLM-as-judge scoring (faithfulness, completeness) on top of deterministic checks
- [ ] Remote MCP servers as tool sources (`tools: mcp://...` in the manifest)
- [ ] Embeddable network-panel web component for production UIs
- [ ] Multi-pack serving (one server, many teams)
- [ ] Streaming token-level answers

## About

Built by [Selvakumar Murugesan](https://www.linkedin.com/in/selvaonline/). Declarative agent teams for the TypeScript ecosystem, with the batteries (UI, MCP, evals) included.

**Open to opportunities** in AI engineering / agentic systems. Issues and PRs welcome — first-time contributors get same-day responses.

MIT © Selvakumar Murugesan
