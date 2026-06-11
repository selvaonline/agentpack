# The manifest

One `agentpack.yaml` describes the whole team. Prompts can live in markdown files; tools are plain TS/JS modules.

```yaml
name: ma-deal-team              # slug (used in URLs and the API)
title: "M&A Deal Agent"         # display name for the UI
description: "Evaluates acquisition targets end to end."

supervisor:
  name: deal_lead               # optional, defaults to "supervisor"
  prompt: ./prompts/supervisor.md   # optional — a strong default is generated

specialists:
  - name: target_scout
    description: "Finds acquisition targets matching given criteria."   # what the supervisor sees
    prompt: ./prompts/target_scout.md                                   # or inline text
    tools: [search_targets, get_company_profile]
    approval: false             # true = human must approve each delegation

tools: ./tools                  # directory of tool modules — or a list:
# tools:
#   - ./tools
#   - mcp:https://host/mcp     # every tool on a remote MCP server

examples:                       # clickable chips in the dev UI
  - "Find healthcare software targets with $50M-$200M revenue."

guardrails:                     # domain-specific anti-rationalization pairs
  - excuse: "This metric is an estimate, so I should not quote it"
    rebuttal: "Quote it and label it as an estimate."
```

## Tools are plain objects

No framework imports — any module exporting objects with `schema` + `execute` works:

```ts
export const search_targets = {
  category: "research",
  schema: {
    name: "search_targets",
    description: "Search acquisition targets. All filters optional.",
    parameters: {
      type: "object",
      properties: {
        sector: { type: "string", description: "Industry sector" },
        min_revenue_m: { type: "number" },
      },
      required: [],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    return { results: [/* ... */] };
  },
};
```

Because tools are deterministic functions with JSON-schema inputs, they're directly callable (zero LLM tokens) via `POST /api/tools/execute` — which is also what makes golden-testing them trivial.

## Prompt rules that make teams reliable

Specialist prompts should instruct the agent to:

- act immediately with whatever criteria were given — all filters are optional
- report every field the tools return, verbatim
- never ask the user for more information
- be honest when data is unavailable

The built-in [guardrails](guardrails.md) reinforce these automatically.

## Model selection

Set one key in `.env` — the framework picks the provider: `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `GROQ_API_KEY`. Override models with `AGENTPACK_MODEL` (specialists) and `AGENTPACK_SUPERVISOR_MODEL` (supervisor — defaults to a stronger tier where available).
