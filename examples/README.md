# Examples

`webhook-hardening.patch` is a synthetic pull request. The Stripe-shaped string in it is not a real key.

```bash
node --experimental-strip-types src/cli.ts review --input examples/webhook-hardening.patch
node --experimental-strip-types src/cli.ts review --input examples/quiet.patch
```

`skimless.config.json` is a starting config for CI. Copy it to the root of the repo you are reviewing.
