# CommitGrep — Discovery Notes

## Pain point
Developers frequently need to find *when and why* something changed: a removed function, an introduced bug, a deleted file, a config line. The raw tooling (`git log -S`, `git log -G`, `git log --grep`) is powerful but has sharp edges: `-S` only matches on diff context, `--grep` is case-sensitive by default, date filters require exact `--since` formats, path filters exclude nothing by default, and output formatting for scripting is ad-hoc. Nothing produces a clean, machine-readable report of matching commits with combined filters (time window + author + path + message/file-content query).

## Existing alternatives
| Tool | Gap |
|---|---|
| `git log -S <term>` | Diff-context-only matching; no semantic message search; no JSON report |
| `git log -G <regex>` | Regex on patch text, slow on large histories, no time-window-first UX |
| `git log --grep` | Case-sensitive default, single predicate, no reporting |
| [git-grep history tools (e.g. `git-sim`)] | Visualization-focused, not scriptable reports |
| CI log scrapers (Cronitor-style) | Runtime monitoring, not historical search |

## Decision
CommitGrep: a dependency-free Node CLI that runs over local git history via the
git binary (present wherever repos exist), exposing:
- message regex search (case-insensitive by default)
- diff-content search (`-d` = `-S` semantics: term appears in diff)
- `--since/--until` ISO8601 time window
- `--author` filter (regex on author name/email)
- `--path` file filter (only commits touching paths)
- `--format json|text|count` report output
- `-r/--root` required absolute path to the repo; errors exit 2, matches 0, no-matches 1
No runtime npm dependencies. Vitest + tsc strict for quality.

## Constraints
- Only stdin-spawned git; the CLI never shells out to anything else.
- Binary messages are rejected as errors (UTF-8 only).
- Must not traverse outside the repo (path traversal in --path rejected).
