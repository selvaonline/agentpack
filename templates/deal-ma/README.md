# ma-deal-team — an agentpack template

An M&A acquisition team: a deal lead delegating across the six-role deal
lifecycle — target scout, risk analyst, market analyst, financial modeler,
portfolio manager, and deal writer — over deterministic demo tools
(mock pipeline data, weighted risk scoring, real DCF/comps math).

```bash
cp .env.example .env       # add one LLM key
npx agentpack dev          # http://localhost:3000 — live network UI + MCP at /mcp
npx agentpack eval         # behavioral evals against the running server
```

Try: *"Evaluate CloudFleet Logistics as an acquisition: pull its profile,
score the diligence risk, give me the sector outlook, value it with a DCF
and comps, check portfolio fit, and draft the IC memo."*

## Make it yours

- **Remove a role**: delete its block from `agentpack.yaml`, restart. Done.
- **Add a role** (e.g. legal counsel): add a block + a prompt file + tools.
- **Real data**: replace the mock datasets in `./tools` with your CRM,
  data-provider, or ERP calls — the schemas stay, the team doesn't change.
