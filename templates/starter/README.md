# trip-planner — an agentpack team

A travel-planning agent team: a supervisor delegating to a destination
scout, a budget planner, and an itinerary writer over deterministic demo
tools (no external APIs needed).

```bash
cp .env.example .env       # add one LLM key
npx agentpack dev          # http://localhost:3000 — live network UI + MCP at /mcp
npx agentpack eval         # behavioral evals against the running server
```

Try: *"Plan a 5-day trip to Japan in spring on a $3000 budget: research the
destination, estimate the costs, and write a day-by-day itinerary."*

Edit `agentpack.yaml` to reshape the team — add a specialist, point it at
new tools in `./tools`, restart. That's the whole workflow.
