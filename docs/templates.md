# Templates

Scaffold any template with:

```bash
npx @selvaonline/agentpack templates            # list ids
npx @selvaonline/agentpack init my-dir --template <id>
```

| Template | Team | Tools (deterministic demo data — swap for your APIs) |
|---|---|---|
| `deal-ma` | M&A acquisition team | target screening, weighted risk scoring, sector multiples, real DCF math, portfolio fit |
| `deal-vc` | VC investment team | deal-flow sourcing, founder/market risk, TAM/SAM/SOM + dilution math, fund-thesis fit |
| `deal-procurement` | Procurement sourcing team | vendor search, supplier risk, category intel, TCO modeling, spend concentration |
| `equity-research` | Equity research team | universe screening, earnings-quality scoring, DCF + peer multiples, initiation notes |
| `claims-triage` | Insurance claims triage | claim/policy lookup, fraud scoring, severity + reserve math, triage decisions |
| `support-triage` | Customer support triage | ticket queue, known-issue matching, P1–P4 + SLA scoring, drafted replies |
| `starter` | Trip-planning team | the gentlest possible introduction |

Every template ships with its own prompts, eval cases, and a README. All of them are running live at [agentpack.selvaonline.com](https://agentpack.selvaonline.com) — switch teams with the tabs.

!!! tip "Demo data by design"
    Template tools return deterministic sample data so teams run end-to-end with zero setup beyond an LLM key. Each tool file marks exactly where to wire in your real APIs.
