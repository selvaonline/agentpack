# procurement-deal-team — an agentpack template

A procurement sourcing team: a sourcing lead delegating across the six-role
deal lifecycle — vendor scout, risk analyst, market analyst, financial
modeler, portfolio manager, and deal writer — over deterministic demo tools
(mock supplier base, supplier-risk scoring, real TCO math).

```bash
cp .env.example .env       # add one LLM key
npx agentpack dev          # http://localhost:3000 — live network UI + MCP at /mcp
npx agentpack eval         # behavioral evals against the running server
```

Try: *"Evaluate CargoLink for our APAC parcel contract at 500,000 parcels per
year over 3 years: profile the vendor, score the supplier risk, give me the
logistics category intel, model the TCO, check the spend-portfolio impact,
and draft the sourcing recommendation."*

## Make it yours

- **Remove a role**: delete its block from `agentpack.yaml`, restart. Done.
- **Add a role** (e.g. legal/contracts): add a block + prompt + tools.
- **Real data**: replace the mock supplier base in `./tools` with your ERP
  or vendor-master calls — the schemas stay, the team doesn't change.
