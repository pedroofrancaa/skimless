# Skimless

[![CI](https://github.com/pedroofrancaa/skimless/actions/workflows/ci.yml/badge.svg)](https://github.com/pedroofrancaa/skimless/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/skimless)](https://www.npmjs.com/package/skimless)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

English · [Português](README.pt-BR.md)

**The reading order for pull requests that got too big.**

Skimless turns a diff into a packet: what to read first, which files can wait, and which lines deserve a human. It runs on your machine. It does not call a model, post a comment, or phone home.

Zero runtime dependencies. Node.js 22 or newer. A CLI, a GitHub Action, a library, and an MCP server for AI agents. Packets in English and Portuguese.

```bash
npx skimless demo
```

[![A Skimless review packet: headline, stats, and the reading order](docs/packet.svg)](https://pedroofrancaa.github.io/skimless/proof.html)

```text
skimless  Do not skim this one
14 files · +86 −8 · about 2 min. 5 high-priority findings.
First pass: index.ts, fixture.ts, verify.ts.

 1  src/api/index.ts                  Public export changed
 2  src/webhooks/fixture.ts           Secret-shaped string added
 3  src/webhooks/verify.ts            Signature compared with ==
 4  .github/workflows/release.yml     Workflow grants write permissions
 5  src/billing/invoice.ts            Billing path changed
 6  test/webhooks/verify.test.ts      Test file deleted
 7  migrations/2026_09_23_api_keys.sql
 8  src/billing/charge.ts
 9  package.json                      Dependency manifest changed
10  Dockerfile
11  test/billing/charge.test.ts       Can wait
12  docs/webhooks.md                  Can wait
13  package-lock.json                 Can wait
14  src/generated/types.ts            Can wait
```

The sample `verify.ts` calls `timingSafeEqual` on a buffer compared with itself. Skimless has no rule for that. It puts the file third, under the live-shaped key, so a person sees it. That is the product: a path through the diff, not a verdict.

[English packet](https://pedroofrancaa.github.io/skimless/proof.html) · [Pacote em português](https://pedroofrancaa.github.io/skimless/prova.html)

## Why this exists

Pull requests written with an agent get big. The reviewer opens the first file, gets tired, and approves the lockfile with the same glance they would give a migration. Skimless tells you where skimming is safe and where it is not: the public API first, the sharp edges next, the noise at the end. The score is a reading priority. A quiet packet does not prove the diff is safe.

## Run it

```bash
npx skimless demo
npx skimless demo --lang pt --format html --out skimless.html
npx skimless review --base origin/main --format all --out skimless --fail-on high
```

Or install it once with `npm install -g skimless` and call `skimless`.

`--format all` writes `skimless.html`, `skimless.md`, and `skimless.json`. Secret-shaped strings are redacted unless you pass `--no-redact`. `--fail-on` defaults to `none` locally. In CI, use `high`.

On a generated 2,000-file diff, a review packet comes back in about 100 ms on a laptop. `npm run bench` prints the number for your machine.

```js
import { redactPacket, reviewDiff } from "skimless";

const packet = redactPacket(reviewDiff(patch, { order: "story", lang: "pt", budgetMinutes: 25 }));
packet.readingOrder.forEach((stop) => console.log(stop.path, stop.reason));
```

## What the packet is

- A reading order. `story` is the default: API and types, then auth, signing, billing, migrations, and CI, then manifests, then the rest, then tests, docs, lockfiles, and generated code. A high finding jumps its file up into the sharp band. `risk` sorts by score alone.
- Findings with the rule id attached. Twenty-one rules, each one a sentence, covering JavaScript, TypeScript, Python, Ruby, Go, PHP, Java, Kotlin, Rust, and C#, plus GitHub Actions, GitLab CI, and other runners. See [docs/rules.md](docs/rules.md).
- An HTML file you can attach, a Markdown comment, and JSON for whatever you already run.

Copy [examples/skimless.config.json](examples/skimless.config.json) to `skimless.config.json` to set the budget, ignore globs, and the CI failure level.

## CI

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: pedroofrancaa/skimless@v1
  with:
    base: origin/${{ github.base_ref }}
    fail-on: high
```

The action needs no token and posts no comment. The reading order and findings land in the job summary, on the pull request's Checks page. It passes inputs through the environment, then to `git diff` as arguments, never stitched into a shell string. [docs/ci.md](docs/ci.md) has the full workflow, every input, and a GitLab CI job.

## Use it from an agent

`skimless mcp` is an MCP server. Claude Code, Cursor, VS Code, and other agents can ask for the reading order before they review a change, then read the files in that order.

```bash
claude mcp add skimless -- npx -y skimless mcp
```

Skimless still does not call a model. It serves one. Secret-shaped strings are always redacted in MCP responses, so a live key in the diff never reaches the agent's context. [docs/mcp.md](docs/mcp.md) has the setup for each client, the tool arguments, and prompts that work.

## What it will not do

- It will not execute the diff.
- It will not call a model, and it will not pretend a heuristic is one. Agents can call Skimless; Skimless does not call them.
- It will not catch every bug. The self-compare in the sample is the example we keep on purpose.
- A quiet label is not an approval.

## Development

```bash
npm install
npm test
npm run check
node --experimental-strip-types src/cli.ts demo
```

Day to day, the CLI runs the TypeScript source directly. `npm run build` emits `dist/`, which is what npm ships.

Rules, reading order, and the library surface are described in [docs/](docs/). The contributor notes are in [CONTRIBUTING.md](CONTRIBUTING.md). The project is MIT, in [GOVERNANCE.md](GOVERNANCE.md) terms: one maintainer at the start, decisions in the open, no pretended community.

## License

[MIT](LICENSE)
