# @gluedly/mcp-server

Model Context Protocol (MCP) server that exposes Gluedly’s public API to AI clients such as Claude Desktop.

## Requirements

- Node.js 18+
- A Gluedly API key

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `GLUEDLY_API_KEY` | Yes | — |
| `GLUEDLY_BASE_URL` | No | `https://gluedly.com/api/v1` |

## Tools

| Tool | Description |
|---|---|
| `gluedly_list_pages` | `GET /pages` — list mapped pages (`id`, `title`, `url`, `next_scrape_date`) |
| `gluedly_trigger_scrape` | `POST /execute` with `{ page_id }` — run a scrape now |
| `gluedly_get_snapshot` | Resolve latest snapshot if needed, then `GET /pages/{page_id}/data/{snapshot_id}` as JSON rows or Markdown |

## Claude Desktop config

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gluedly": {
      "command": "npx",
      "args": ["-y", "@gluedly/mcp-server"],
      "env": {
        "GLUEDLY_API_KEY": "YOUR_GLUEDLY_API_KEY"
      }
    }
  }
}
```

Optional custom API host:

```json
{
  "mcpServers": {
    "gluedly": {
      "command": "npx",
      "args": ["-y", "@gluedly/mcp-server"],
      "env": {
        "GLUEDLY_API_KEY": "YOUR_GLUEDLY_API_KEY",
        "GLUEDLY_BASE_URL": "https://gluedly.com/api/v1"
      }
    }
  }
}
```

## Local development

```bash
bun install
bun run build
bun run test
GLUEDLY_API_KEY=… node dist/index.js
```
