# vc-deal-team — an agentpack template

A venture capital investment team: an investment lead delegating across the
six-role deal lifecycle — startup scout, risk analyst, market analyst,
financial modeler, portfolio manager, and deal writer — over deterministic
demo tools (mock deal flow, founder-risk scoring, TAM/SAM/SOM and dilution math).

```bash
cp .env.example .env       # add one LLM key
npx agentpack dev          # http://localhost:3000 — live network UI + MCP at /mcp
npx agentpack eval         # behavioral evals against the running server
```

Try: *"Evaluate Lumenly for our fund: source its profile, score founder and
execution risk, size the market assuming 200,000 target customers at $6,000
ARPU, model the round dilution and a multiple-based valuation, check fund
fit, and draft the investment memo."*

## Make it yours

- **Remove a role**: delete its block from `agentpack.yaml`, restart. Done.
- **Add a role** (e.g. technical diligence): add a block + prompt + tools.
- **Real data**: replace the mock deal flow in `./tools` with your CRM or
  data-provider calls — the schemas stay, the team doesn't change.
