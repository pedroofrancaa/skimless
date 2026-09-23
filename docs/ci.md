# CI

Skimless exits 1 when a finding is at or above `--fail-on`. The packet is still written. `none` is the default so a local run never fails closed by surprise. CI should pass `--fail-on high`.

## GitHub Actions

```yaml
name: Skimless
on:
  pull_request:
permissions:
  contents: read
jobs:
  skimless:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pedroofrancaa/skimless@v1
        with:
          base: origin/${{ github.base_ref }}
          fail-on: high
          format: all
          out: skimless
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: skimless
          path: |
            skimless.html
            skimless.md
            skimless.json
```

The action needs no token and posts nothing. The short packet (headline, reading order, findings) goes to the job summary, on the pull request's Checks page. Set `summary: false` to turn that off. The full packet with diffs is the uploaded artifact.

| Input | Default | |
| --- | --- | --- |
| `base` | empty | Compared as `base...HEAD`. Empty means `HEAD` against the working tree. |
| `fail-on` | `high` | `none`, `info`, `low`, `medium`, or `high`. |
| `format` | `html` | `text`, `html`, `md`, `json`, or `all`. |
| `out` | `skimless.html` | Output path, or the stem when `format` is `all`. |
| `lang` | `en` | `en` or `pt`. |
| `order` | `story` | `story` or `risk`. |
| `summary` | `true` | Write the short packet to the job summary. |

If the runner's Node.js is older than 22, the action installs Node.js 22 with `actions/setup-node`. Later steps in the same job see that version too. Set up your own Node.js before Skimless if you need a different one.

Inputs reach the script through environment variables, then `git diff` as separate arguments. Nothing is interpolated into a shell string.

This repository dogfoods the action from its own checkout in `.github/workflows/proof.yml`, with `uses: ./`.

## GitLab CI and other runners

Any runner with Node.js 22 and a full clone works:

```yaml
skimless:
  image: node:22
  variables:
    GIT_DEPTH: 0
  script:
    - git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx skimless review --base "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME" --format all --out skimless --fail-on high
  artifacts:
    when: always
    paths: [skimless.html, skimless.md, skimless.json]
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## Without CI

```bash
git diff "origin/main...HEAD" > /tmp/pr.diff
npx skimless review --input /tmp/pr.diff --format all --out skimless --fail-on high
```

`--format all` writes `skimless.html`, `skimless.md`, and `skimless.json`, and prints the text packet on stdout. `--summary <file>` appends the short Markdown packet to any file.
