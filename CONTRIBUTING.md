# Contributing

Skimless stays useful if every rule remains explainable and local.

## Ground rules

- Zero runtime dependencies. A parser, a scorer, and a printer do not need a framework.
- No network calls in the library, the CLI, or the tests.
- A new rule needs a one-line description in `src/analyze/rules.ts`, a row in `docs/rules.md`, and a test that fails when the rule disappears.
- Do not add a rule that only exists to catch the sample patch. The sample is a demo, not the spec.
- Heuristics may be wrong. Phrase the detail as something a human should look at, not as a verdict.

## Setup

Node.js 22 or newer.

```bash
npm install
npm test
npm run check
npm run demo
```

## Good first changes

- A classifier for a language this repo barely knows (PHPUnit, RSpec, Rust integration tests).
- GitLab CI or Buildkite permission rules, with a fixture.
- A third language next to `en` and `pt`.
- A quieter `missing-tests` stem for files that are pure types.

Open an issue before you rewrite the reading-order bands. People will memorize the order.
