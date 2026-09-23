# MCP

`skimless mcp` serves Skimless to AI agents over the Model Context Protocol, on stdio. The agent asks for a reading order before it reviews a change, and reads the files in that order.

Skimless still does not call a model. It runs `git diff` locally, scores the files, and returns text. Secret-shaped strings are always redacted in MCP responses, so a live key in the diff does not end up in the agent's context or its provider's logs.

## Set it up

Claude Code:

```bash
claude mcp add skimless -- npx -y skimless mcp
```

Cursor, in `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "skimless": {
      "command": "npx",
      "args": ["-y", "skimless", "mcp"]
    }
  }
}
```

VS Code, in `.vscode/mcp.json`:

```json
{
  "servers": {
    "skimless": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "skimless", "mcp"]
    }
  }
}
```

Claude Desktop, Windsurf, Zed, and other clients take the same command: `npx -y skimless mcp`.

## Tools

### `review_diff`

Returns the review packet as Markdown: headline, reading order, and findings with rule ids.

| Argument | | |
| --- | --- | --- |
| `diff` | string | A unified diff. If omitted, Skimless runs `git diff` in the repository. |
| `base` | string | Compare `base...HEAD`, the way a pull request does. Example: `origin/main`. |
| `staged` | boolean | Review only staged changes. |
| `cwd` | string | Repository directory. Defaults to the directory the server started in. |
| `lang` | `en` or `pt` | Packet language. |
| `order` | `story` or `risk` | Reading order mode. |
| `budgetMinutes` | number | Flag a packet that takes longer than this to read. |
| `ignore` | string[] | Glob patterns to skip. |
| `format` | `summary` or `json` | `json` returns the full packet without diff lines. |

With no arguments it reviews the working tree against `HEAD`. `skimless.config.json` in the repository applies, the same as on the command line.

### `list_rules`

Every rule with its severity and one-line meaning.

## Prompts that work

- "Before you review this branch, get the Skimless reading order against origin/main and follow it."
- "Summarize my staged changes. Use Skimless first and start with what it says to read now."
- "This PR is 80 files. Ask Skimless what can wait, and skip it unless something points there."

If the client starts the server outside the repository, the agent can pass `cwd` with the repository path.

## Safety

- Read-only. The server runs `git diff` and nothing else, with external diff drivers and textconv turned off.
- Refs that look like options (anything starting with `-`) are rejected, so a prompt cannot turn `base` into a git flag.
- No network. The server makes no requests of its own.
