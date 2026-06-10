# claims-triage-team — an agentpack template

An insurance claims triage team: a claims lead delegating across the triage
lifecycle — intake clerk, fraud analyst, severity assessor, and resolution
writer — over deterministic demo tools (mock claims core, fraud scoring,
severity/reserve math).

```bash
cp .env.example .env       # add one LLM key
npm run dev                # http://localhost:3000 — live network UI + MCP at /mcp
npm run eval               # behavioral evals against the running server
```

Try: *"Triage claim CLM-2031: look it up, verify the policy, score fraud
risk, estimate severity and reserve, and give me the triage decision."*

## Make it yours

- **Remove a role**: delete its block from `agentpack.yaml`, restart. Done.
- **Add a role** (e.g. subrogation specialist): add a block + prompt + tools.
- **Approval gates**: add `approval: true` to a specialist (e.g. the
  resolution writer) to require human sign-off before it runs.
- **Real data**: replace the mock claims core in `./tools` with your claims
  system's API — the schemas stay, the team doesn't change.
