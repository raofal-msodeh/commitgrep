# CommitGrep

**CommitGrep** is a fast, zero-dependency command-line tool for searching Git history.
It finds commits matching a message pattern, a code pattern (via `git log -S` pickaxe search),
an author, or a date range — and can emit either a compact human-readable summary or a
machine-friendly JSON report, ideal for CI pipelines, audit scripts, and release notes.

It is part of the **FORGE20** portfolio: twenty independent, open-source developer tools
built with strict quality gates.

| | |
| --- | --- |
| License | [MIT](LICENSE) |
| Language | TypeScript (compiled to JavaScript) |
| Runtime | Node.js ≥ 16 (zero npm runtime dependencies) |
| Binaries | 1 (`commitgrep`) |
| Tests | 19 unit/integration tests + 11 hostile-input red-team scenarios |

## Why CommitGrep?

Searching Git history with raw `git log` flags is error-prone: output formats vary,
`--since`/`--until` parsing is strict, pickaxe semantics are confusing, and formatting
history across time zones is tedious. CommitGrep wraps this complexity in a single,
validated CLI that:

- **Validates every input** — repository roots, path filters, dates, and regexes are
  checked before execution; traversal attempts and malformed patterns fail fast with
  clear messages instead of producing silently wrong results.
- **Is deterministic and locale-safe** — commits are sorted strictly by author date,
  and timestamps are emitted in ISO 8601 so reports are stable across machines and CI runs.
- **Runs without network or npm baggage** — the published package has **zero runtime
  dependencies**; it shells out to the local `git` binary only.

## Installation

```bash
# From npm
npm install -g commitgrep   # (publish after review)

# Or from source
git clone https://github.com/raofal-msodeh/commitgrep.git
cd commitgrep
pnpm install
pnpm run build
pnpm link --global
```

## Usage

```bash
commitgrep <repo-root> [options]
```

Search the Git history of `<repo-root>` (the directory containing `.git`).
Results are printed to stdout; with `-o`/`--out`, they are also written to a JSON file.

### Options

| Flag | Description |
| --- | --- |
| `-p, --pattern <regex>` | Filter commit messages by a **case-sensitive** regular expression |
| `-i, --insensitive` | Make `-p` case-insensitive |
| `-S, --code <string>` | Pickaxe search: find commits that change the number of occurrences of `<string>` |
| `-a, --author <name>` | Filter by author name or email substring |
| `-f, --paths <path,...>` | Restrict to commits touching the given repo-relative paths |
| `-s, --since <date>` | Only commits at or after this date (ISO 8601 or `YYYY-MM-DD`) |
| `-u, --until <date>` | Only commits before this date (ISO 8601 or `YYYY-MM-DD`) |
| `-n, --max <count>` | Maximum number of matching commits to report |
| `-o, --out <file>` | Write the full JSON report to a file (may be relative to cwd) |
| `-h, --help` | Show help and exit |

Flags may be repeated: multiple `-f`, `-s`, or `-u` values are combined (paths are
intersected with `--all-match` semantics is not required since they are applied
as a single `--` path list; multiple dates use earliest since / latest until).

### Examples

```bash
# All commits touching src/ that mention a ticket number
commitgrep . -p 'JIRA-[0-9]+' -f src/

# Find every commit that added or removed the word "deprecated"
commitgrep /srv/app -S deprecated -i

# Commits by alice between two dates
commitgrep ~/code -a alice -s 2025-01-01 -u 2025-07-01

# Top 10 matches, save the JSON report for downstream tooling
commitgrep . -p 'breaking' -n 10 -o matches.json
```

## Output format

### Human-readable (stdout)

```
commit 4a7b2c1 (2026-03-12T09:14:02Z) by Jane Doe <jane@example.com>
  +142 -37 (3 files)  feat(engine): add pickaxe search with input validation
  [src/engine.ts, src/log.ts, src/cli.ts]
```

Each matching commit is printed with its short hash, ISO-8601 author date, author,
insertions/deletions/file counts, and the first line of the message. Paths touched
by the commit are listed when `-f` is not used or when requested via `--verbose`.

### JSON report (`-o`)

```json
{
  "tool": "commitgrep",
  "version": "1.0.0",
  "repoRoot": "/home/user/project",
  "filters": { "pattern": "JIRA-[0-9]+", "paths": ["src"] },
  "matchCount": 2,
  "matches": [
    {
      "hash": "4a7b2c1d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      "shortHash": "4a7b2c1",
      "authorName": "Jane Doe",
      "authorEmail": "jane@example.com",
      "authorDate": "2026-03-12T09:14:02Z",
      "subject": "feat(engine): add pickaxe search",
      "insertions": 142,
      "deletions": 37,
      "filesChanged": 3,
      "touchedPaths": ["src/engine.ts", "src/log.ts"]
    }
  ]
}
```

## Error handling

CommitGrep never prints a half-formed result. If the repository root is missing,
not a Git repository, or a relative path; if a path filter attempts traversal
(`..`, absolute paths, null bytes); if a regex fails to compile; or if a date
cannot be parsed — the tool exits with code **2** and a clear diagnostic.
With no matches it exits with code **1** and an empty JSON report (`matchCount: 0`)
when `--out` is used, keeping CI scripts predictable.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | One or more matches |
| 1 | Zero matches (or empty repository) |
| 2 | Invalid arguments or environment (see stderr) |

## Development

```bash
pnpm install        # dev dependencies only (typescript, vitest)
pnpm run build      # tsc -> dist/
pnpm run test       # vitest, all suites
pnpm run test:coverage  # vitest with coverage report
bash scripts/red_team.sh  # hostile-input validation
```

## Security model

- Repository roots are resolved via `realpath` and required to be absolute and
  to contain a `.git` directory.
- Path filters are normalized inside the repository boundary; anything that would
  escape (`..`, `/`, null bytes) is rejected before `git` is invoked.
- User-supplied patterns reach `git` only through fixed-format arguments
  (`--grep=...`, `-S`, `--author`), never interpolated into shell strings.
- Regular expressions are validated by compiling them before use; unbalanced or
  catastrophic patterns are rejected.

## Contributing

Contributions are welcome. Please run `pnpm run build && pnpm run test` and
`bash scripts/red_team.sh` before opening a pull request, and keep the test
suite green at 100% pass.

## License

MIT — see [LICENSE](LICENSE).
