# Changelog

## 0.1.0

First public packet.

- Unified diff parser for adds, deletes, renames, quoted paths, and binary markers.
- Story and risk reading orders.
- Twenty-one explainable rules, English and Portuguese copy, and redaction that runs after scoring.
- Command-execution patterns for Python, Ruby, Go, PHP, Java, Kotlin, Rust, and C#, not only JavaScript.
- Secret shapes for Anthropic, OpenAI, Google, npm, and current GitHub tokens, redacted in every format.
- CI rules for privileged triggers and publish steps, across GitHub Actions, GitLab CI, Buildkite, and other runners.
- `--summary <file>` appends a short packet, sized for `$GITHUB_STEP_SUMMARY`.
- `skimless mcp`, an MCP server on stdio with `review_diff` and `list_rules`, so agents can ask for the reading order. Responses are always redacted.
- Git refs that look like options are rejected, and `git diff` runs with external diff drivers and textconv turned off.
- Text, HTML, Markdown, and JSON packets. `--format all` writes the three files.
- `skimless.config.json`, ignore globs, a review budget, and `--fail-on` for CI.
- A composite GitHub Action that passes inputs through the environment, not through a shell string, sets up Node.js 22 when the runner is older, and writes the job summary.
