# support-triage-team — an agentpack template

A customer support triage team: a support lead delegating across the triage
lifecycle — ticket scout, diagnosis analyst, impact assessor, and response
writer — over deterministic demo tools (mock ticket queue, known-issue
database, priority/SLA scoring).

```bash
cp .env.example .env       # add one LLM key
npm run dev                # http://localhost:3000 — live network UI + MCP at /mcp
npm run eval               # behavioral evals against the running server
```

Try: *"Triage ticket TIC-484: pull it and the customer, diagnose against
known issues, score the priority, and draft the reply and routing note."*

## Make it yours

- **Remove a role**: delete its block from `agentpack.yaml`, restart. Done.
- **Add a role** (e.g. refunds specialist): add a block + prompt + tools.
- **Approval gates**: add `approval: true` to the response writer to require
  human sign-off before customer-facing text is drafted.
- **Real data**: replace the mock queue in `./tools` with your helpdesk API
  (Zendesk, Intercom, …) — the schemas stay, the team doesn't change.
