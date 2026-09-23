# Governance

Skimless is a small tool with a single maintainer at the start. That is a fact, not a costume.

- Issues and pull requests are the decision record.
- A change to scoring, redaction, or the default reading order needs a note in `CHANGELOG.md`.
- Releases follow semver. 0.x may break the JSON packet if the changelog says so.
- The maintainer merges. Review from someone else is wanted, and not pretended when it did not happen.

If you rely on Skimless in CI, pin a version. The sample packet in `site/` is regenerated from `examples/webhook-hardening.patch` and is not a stable API.
