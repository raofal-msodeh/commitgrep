# ADR 0001: Foundation — A Validated Git History Search CLI

## Status

Accepted — 2026-08-16

## Context

Developers and CI pipelines frequently need to answer questions about Git history:
"which commits mention this ticket?", "who changed this string?", "what changed in
`src/` between these dates?" Raw `git log` flags (`--grep`, `-S`, `--author`,
`--since`/`--until`, `-- path/to/file`) can compose these queries, but composing
them correctly in scripts is fragile:

- Output format varies across `git` versions and user configuration (`log.date`,
  `log.showSignature`), so parsing is unstable in automation.
- There is no validation layer: malformed regexes, invalid dates, or path filters
  that silently match nothing produce confusing downstream failures.
- Path filters are shell-interpolated in typical scripts, inviting traversal
  and injection problems.
- No machine-readable report format exists out of the box; downstream tooling
  must re-parse colored or formatted output.

## Decision

We build **commitgrep**: a single CLI binary that

1. Accepts message regex (`-p`), pickaxe string (`-S`), author (`-a`), paths
   (`-f`), date window (`-s`/`-u`), and match limit (`-n`).
2. Validates every input *before* invoking `git`: absolute resolved repo root
   containing `.git`; path filters normalized inside the root with explicit
   rejection of `""`, leading `/`, null bytes, and leading `..`; regexes compiled
   up front; dates parsed with a strict parser and passed to `git` as ISO 8601.
3. Uses fixed-format `git log` (`--pretty=format:` with field separators) so
   parsing never depends on locale, signature decoration, or Git version output
   quirks.
4. Computes per-commit stats with `git diff-tree --root --numstat` (the `--root`
   flag handles the initial commit without special casing).
5. Emits both a human-readable summary to stdout and, with `-o`, a strict JSON
   report with stable ISO 8601 timestamps.
6. Uses deterministic exit codes: `0` matches, `1` no matches, `2` invalid
   arguments/environment.

## Consequences

- **Positive**: scripts and CI get a stable, typed report; invalid inputs fail
  fast with clear diagnostics instead of silently wrong results; the package
  carries zero runtime dependencies beyond Node ≥ 16 and a local `git` binary,
  keeping supply-chain risk minimal.
- **Negative**: results depend on the installed `git` binary's semantics
  (pickaxe matches by diff, so a string added and removed in one commit matches);
  this is documented as intended behavior rather than worked around.
- **Trade-off accepted**: we shell out to `git` rather than vendoring a Git
  implementation (e.g., isomorphic-git); repository sizes and performance remain
  bounded by `git`'s own indexing, and we avoid maintaining a second parser.
