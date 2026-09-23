# Rules

Skimless flags are heuristics for reading order. Each one should fit in a sentence. A flag is not a vulnerability proof, and a quiet packet is not a proof that the diff is safe.

| Rule | Level | What it means |
| --- | --- | --- |
| `secret-pattern` | high | An added line matches a credential shape: AWS key id, private key block, GitHub tokens (`ghp_`, `gho_`, `ghs_`, `github_pat_`), Slack token, Stripe live or restricted key, Anthropic and OpenAI API keys, Google API key, npm token. |
| `code-exec` | high | An added line can run a command or load untrusted code. Everywhere: `eval`, `new Function`, `pickle.loads`, `os.system`, `shell=True`, Node's `child_process` / `execSync`. By file type: Python `os.popen`, `exec()`, `marshal.loads`; Ruby `system`, `exec`, `spawn`, interpolated backticks or `%x`, `IO.popen`, `Open3`, `Marshal.load`; Go `exec.Command`; PHP `shell_exec`, `exec`, `system`, `passthru`, `proc_open`, `popen`, `unserialize`; Java and Kotlin `Runtime.exec`, `ProcessBuilder`; Rust `Command::new`; C# `Process.Start`. |
| `timing-compare` | high | A name containing signature, digest, or HMAC is compared with `==`, `===`, `!=`, or `!==` outside a test file. Checks against `null`, `undefined`, `None`, `nil`, booleans, `0`, or an empty string stay quiet. |
| `workflow-permissions` | high | A workflow adds a write permission (`contents: write`, `id-token: write`, `write-all`, and the same family). |
| `privileged-trigger` | high | A workflow adds `pull_request_target` or `workflow_run`, which run with the base repository's token and secrets. |
| `deleted-tests` | high | A test file was removed. |
| `migration` | high | The path is a migration, or a SQL file adds DDL. |
| `sensitive-surface` | medium | An auth, billing, or signing file changed, and nothing higher already explains it. |
| `missing-tests` | medium | A behavior file changed by at least `testGapLines` (default 15) and no surviving test file covers its name. |
| `html-sink` | medium | `innerHTML` or `dangerouslySetInnerHTML` was added. |
| `dependency-manifest` | medium | A package manifest gained or lost a dependency range. |
| `runtime-config` | medium | A Dockerfile, Compose file, Terraform file, or deploy chart changed. |
| `api-change` | medium | A public route or `index` module changed an export. |
| `large-file` | medium | One file carries at least `largeFileLines` changed lines (default 400). Lockfiles, docs, assets, and generated files are exempt. |
| `over-budget` | medium | The estimated read exceeds `budgetMinutes`. Off unless you set a budget. |
| `lockfile` | medium | A lockfile changed. Read it after the manifest, looking for a surprise package. |
| `ci-publish` | medium | A CI file adds a publish or push step: `npm publish` and friends, `twine upload`, `cargo publish`, `gem push`, `docker push`, `git push`, `gh release create`, `nuget push`, GoReleaser, or a publish action. Works for GitHub Actions, GitLab CI, Buildkite, CircleCI, Azure Pipelines, Bitbucket, Travis, Drone, Woodpecker, and Jenkins. |
| `ci-changed` | low | Automation changed and none of the CI rules above fired. |
| `binary-file` | low | The diff has no lines to read. |
| `whitespace-only` | info | Trimmed added and removed lines match. Other rules stand down. |
| `generated-file` | info | The path looks generated. Review the generator, not the output. |

`skimless rules` prints this list from the same catalog the engine uses.
