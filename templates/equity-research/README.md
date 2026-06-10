# equity-research-team — an agentpack template

A sell-side style equity research team: a research director delegating across
the coverage lifecycle — coverage scout, fundamentals analyst, valuation
analyst, and report writer — over deterministic demo tools (mock coverage
universe, earnings-quality scoring, DCF and peer-multiple math).

```bash
cp .env.example .env       # add one LLM key
npm run dev                # http://localhost:3000 — live network UI + MCP at /mcp
npm run eval               # behavioral evals against the running server
```

Try: *"Initiate coverage on Meridian Semis: pull its fundamentals, check
earnings quality, value it with a DCF and peer multiples, and write the
initiation note with a rating."*

## Make it yours

- **Remove a role**: delete its block from `agentpack.yaml`, restart. Done.
- **Add a role** (e.g. macro strategist): add a block + prompt + tools.
- **Real data**: replace the mock universe in `./tools` with your market-data
  API — the schemas stay, the team doesn't change.
