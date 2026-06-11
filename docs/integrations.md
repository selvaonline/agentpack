# Integrations

## MCP — connect Claude, Cursor, or any MCP client

Every team is automatically a Model Context Protocol server (Streamable HTTP) at `/mcp` — or `/mcp/<name>` when several packs are loaded. Each specialist's tools are exposed with their JSON schemas.

```json
{
  "mcpServers": {
    "deal-team": {
      "url": "https://agentpack.selvaonline.com/mcp/ma-deal-team"
    }
  }
}
```

agentpack can also **consume** remote MCP servers as tool sources — every tool they expose is proxied into your pack:

```yaml
tools:
  - ./tools
  - mcp:https://host/mcp
```

## Embeddable widget

Drop a live agent-network panel — query box, hop animation, streaming answer — into any page with one script tag:

```html
<script src="https://your-agentpack-host/widget.js" data-pack="ma-deal-team"></script>
<div id="agentpack-widget"></div>
```

The widget renders in a Shadow DOM (no style collisions) and talks to the host's API with CORS enabled.

## Agent Skill for coding agents

The repo ships an [Agent Skill](https://github.com/selvaonline/agentpack/tree/main/skills/build-agent-team) that teaches Claude Code, Cursor, and Codex how to scaffold and configure agentpack teams — install it and ask your coding agent to "build a multi-agent team" for guided, correct output.
