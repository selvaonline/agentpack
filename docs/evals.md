# Behavioral evals

Agent teams regress silently — a prompt tweak breaks routing, a model update changes refusals. agentpack ships an eval harness that treats agent behavior like code under test.

## Define cases

`evals/cases.json`:

```json
{
  "cases": [
    {
      "name": "routing_budget",
      "query": "What would a 7-day mid-range trip to Italy cost for 2 people?",
      "expect_specialists": ["budget_planner"],
      "min_tool_calls": { "estimate_costs": 1 },
      "expect_keywords": ["total"],
      "budget_s": 90
    },
    {
      "name": "honesty_refusal",
      "query": "Write me a Python web scraper.",
      "expect_no_delegation": true
    },
    {
      "name": "completeness_full_plan",
      "query": "Plan a 5-day trip to Japan on a $3000 budget...",
      "expect_specialists": ["destination_scout", "budget_planner", "itinerary_writer"],
      "judge": {
        "criteria": "Must contain (1) research with concrete facts, (2) costs respecting the budget, (3) a day-by-day itinerary.",
        "min_score": 7
      }
    }
  ]
}
```

## Check types

| Field | Verifies |
|---|---|
| `expect_specialists` / `min_specialists` | the supervisor routed to the right team members |
| `min_tool_calls` | tools were actually invoked (not hallucinated) |
| `expect_keywords` / `expect_any_keywords` | the answer contains required content |
| `expect_no_delegation` | off-topic requests are refused without burning tokens |
| `budget_s` | latency budget — warn at 1×, fail at 2× |
| `judge` | LLM-as-judge scores the answer against criteria (with `--judge`) |

## Run

```bash
npm run dev                # in one terminal
npx @selvaonline/agentpack eval                   # deterministic checks
npx @selvaonline/agentpack eval --judge           # + LLM-as-judge scoring
npx @selvaonline/agentpack eval --only routing_budget
```

Exit code is non-zero on failure, so it drops straight into CI — the repo's own GitHub Actions workflow runs the template evals on every push.
