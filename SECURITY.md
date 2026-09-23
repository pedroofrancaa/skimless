# Security policy

Skimless reads diffs and writes a packet. It does not execute the code under review and it does not send the diff anywhere.

If you find a vulnerability in Skimless itself — a parser bug that hides a file, a redaction bypass, or a command-injection issue in the CLI or the GitHub Action — please report it privately. Open a private security advisory on GitHub once the repository is published, or email the maintainer listed in the repository profile. Give us a chance to ship a fix before you file a public issue.

Do not open a public issue that includes a live secret, even a secret that Skimless failed to redact. Rotate the credential first.

The rules are not a security audit. A packet with no high findings can still contain a bug, including the kind of bug a human sees in ten seconds and a heuristic never names.
