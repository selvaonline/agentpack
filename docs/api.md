# HTTP API

Every agentpack server exposes the same surface. With multiple packs loaded, address one via the `pack` query/body parameter (defaults to the first).

| Endpoint | What it does |
|---|---|
| `GET /` | Dev UI — live network graph, token streaming, builder, themes |
| `GET /api/health` | `{ ok, packs }` — ok is true when an LLM key is configured |
| `GET /api/packs` | All loaded packs (including browser-built ones) |
| `GET /api/network` | `{ nodes, edges }` team topology |
| `POST /api/run` | Start a run: `{ query, pack?, threadId? }` → `{ runId, threadId }` |
| `GET /api/stream/:runId` | SSE stream of run events (`/events/:runId` alias kept for compatibility) |
| `GET /api/runlog/:runId?after=N` | Polling fallback — same events as plain JSON |
| `POST /api/approve` | Resolve a human-in-the-loop gate: `{ runId, approvalId, approve }` |
| `GET /api/tools` | Tool registry with JSON schemas |
| `POST /api/tools/execute` | Direct tool execution — zero LLM tokens, deterministic |
| `GET /api/toolcatalog` | Every tool available to the builder |
| `POST /api/packs` | Create a custom team at runtime (no restart) |
| `POST /api/suggest` | AI-assisted builder: `{ description }` → full team spec |
| `GET /widget.js` | Embeddable live network panel |
| `ALL /mcp`, `/mcp/:pack` | Auto-generated MCP server per team |

## Run a query end to end

```bash
RUN=$(curl -s -X POST http://localhost:3000/api/run \
  -H 'Content-Type: application/json' \
  -d '{"query": "Find healthcare software targets and score the best one."}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['runId'])")

curl -N http://localhost:3000/api/stream/$RUN
```

Event kinds on the stream: `run_started`, `hop`, `thinking`, `tool_executing`, `tool_complete`, `agent_step`, `answer_token`, `answer_chunk`, `usage`, `approval_request`, `approval_resolved`, `run_finished`.

## Conversation memory

Pass the `threadId` returned by the first run into follow-up runs to keep conversation context:

```json
{ "query": "Now compare it with the second-best target.", "threadId": "abc123..." }
```

## Server configuration

| Env var | Effect |
|---|---|
| `PORT` | listen port (default 3000) |
| `AGENTPACK_RUN_LIMIT` | runs per IP per hour (default 30, 0 = off) |
| `AGENTPACK_BUILD_LIMIT` / `AGENTPACK_SUGGEST_LIMIT` | builder rate limits (default 10/hour) |
| `AGENTPACK_DYNAMIC=0` | disable browser-built teams |
| `AGENTPACK_MODEL` / `AGENTPACK_SUPERVISOR_MODEL` | model overrides |
