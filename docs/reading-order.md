# Reading order

`story` is the default.

1. Public API, types, and schema. You should know what callers will see.
2. Auth, signing, billing, migrations, and automation. Sharp edges, including any other file that picked up a high finding (a deleted test jumps up here).
3. Dependency manifests.
4. Runtime packaging.
5. The rest of the implementation.
6. Tests that did not already jump forward.
7. Docs.
8. Lockfiles, generated code, and assets.

Inside a band, the higher file score comes first. Ties break on the path.

`risk` ignores the story and sorts by file score. Use it when you already know the feature and only want the sharp edges.

The minute estimate skips lockfiles, generated files, and assets, then divides the remaining changed lines by 40, with a floor of 2 minutes when there is anything to read. It is a budget hint, not a measurement of how fast you are.
