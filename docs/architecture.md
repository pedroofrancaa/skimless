# Architecture

Skimless is one pipeline. Nothing in it opens a network connection.

```text
unified diff
  → parsePatch        src/parse/patch.ts
  → classify          src/analyze/classify.ts
  → assessFile        src/analyze/rules.ts
  → cross-file rules  missing tests, review budget
  → sort              story or risk
  → packet            src/review.ts
  → text / html / md / json
```

`reviewDiff` is the library entry. The CLI is a thin shell around it: read a diff from git or a file, merge `skimless.config.json`, redact, write, and exit 1 when `--fail-on` matches.

Redaction happens after scoring. The rules see the original line. The packet you share has credential-shaped strings replaced. A multi-line private key is masked from the begin line through the end line. Lines that only look like key material, without a begin marker, are left alone on purpose.

The HTML packet is one file. The CSS is inlined. It does not load project source, and the filter buttons are optional.

Scores are a weighted sum of findings, capped at 100. The label is `high` when any finding is high. That is deliberate: one live key should not be averaged away by a quiet README. The reverse holds too: without a high finding the score stops at 69, so a large diff full of medium flags reads as "worth a real review", not as an alarm.
