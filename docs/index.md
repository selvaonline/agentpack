# agentpack

**Define your agent team in YAML — get a supervisor, a live network UI, an MCP server, and behavioral evals out of the box.**

agentpack is a batteries-included framework for multi-agent AI teams: a supervisor delegates to specialist agents, each owning a subset of tools, with everything around them — streaming UI, REST API, MCP endpoint, eval harness — generated for you.

[Live demo →](https://agentpack.selvaonline.com){ .md-button .md-button--primary }
[GitHub →](https://github.com/selvaonline/agentpack){ .md-button }

## Quick start

```bash
npx @selvaonline/agentpack init my-team
cd my-team && npm install
cp .env.example .env        # add ONE key: OpenAI, Gemini, or Groq
npm run dev                 # → http://localhost:3000
```

Or let AI design the whole project from a description — manifest, prompts, tool stubs with sample data, and evals:

```bash
npx @selvaonline/agentpack init --describe "a restaurant site-selection team: \
analyze foot traffic and demographics, score competition, recommend the best site"
```

You now have a working team with a live network view at `http://localhost:3000`. Prove it behaves:

```bash
npm run eval
```

## What you get from one manifest

| Capability | How |
|---|---|
| Supervisor + specialist orchestration | LangGraph under the hood, configured from your YAML |
| Live network UI | hop-by-hop animation, token streaming, light/dark themes |
| Build agents in the browser | compose teams from the tool catalog — or describe one and let AI design it |
| MCP server | every team auto-exposed at `/mcp` for Claude, Cursor, any MCP client |
| Behavioral evals | routing, completeness, refusal, tool usage + LLM-as-judge |
| Guardrails | anti-rationalization excuse → rebuttal tables compiled into every prompt |
| Human-in-the-loop | `approval: true` pauses delegations for your sign-off |
| Embeddable widget | one script tag drops the live network panel into any page |

## Where next

- [The manifest](manifest.md) — every field of `agentpack.yaml`
- [Templates](templates.md) — seven ready-made vertical teams
- [AI-assisted building](ai-builder.md) — describe it, get a team
- [HTTP API](api.md) — run teams programmatically
