# AI-assisted building

Describe the team you want; AI designs the specialists, writes their prompts, and picks the tools. Available in three places.

## In the browser

Open the **＋ Build your own** tab on any agentpack server, type a one-line description, and hit **✨ Generate team**:

> *"A family trip planner: research destinations and weather, then build a total budget for the whole group."*

The form is prefilled with the generated team — review, tweak, and **Launch**. The team goes live instantly with the full network view, its own MCP endpoint at `/mcp/<name>`, conversation memory, and a shareable page URL. Browser-built agents expire after 24 hours.

You can also build manually: name the agent, define specialists, and assign tools from the catalog of everything the server has loaded.

## In the CLI

```bash
npx @selvaonline/agentpack init --describe "a claims triage team for auto insurance: \
verify the claim, score fraud risk, assess severity, draft a resolution"
```

This generates a complete project — manifest, specialist prompts, tool stubs, and eval cases. The tool stubs return realistic sample data so the team runs end-to-end immediately; replace their `execute()` bodies with real data sources when ready.

## Over the API

```bash
curl -X POST https://your-host/api/suggest \
  -H 'Content-Type: application/json' \
  -d '{"description": "an equity research team covering semiconductors"}'
```

Returns a full team spec (name, description, supervisor instructions, specialists with prompts and tool picks) ready to `POST /api/packs`.
