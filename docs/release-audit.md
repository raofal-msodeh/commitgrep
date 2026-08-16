# Release Audit — CommitGrep 1.0.0

Date: 2026-08-16
Auditor: FORGE20 pipeline (agent-assisted, human-verifiable)

## Gate checklist

| Gate | Evidence | Status |
| --- | --- | --- |
| Zero runtime dependencies | `package.json` `dependencies: {}` | PASS |
| Type check | `pnpm run build` (tsc, strict) — no errors | PASS |
| Unit/integration tests | `pnpm test` — **19/19 passed** (vitest) | PASS |
| Red-team / hostile input | `bash scripts/red_team.sh` — **11/11 passed** (empty repo, path traversal `../`, null-byte-path, absolute filters, invalid regex/date, non-repo root, relative root, relative report path, no-match exit code) | PASS |
| Deterministic output | `--pretty=format:` fixed separators; ISO 8601 dates; locale-independent | PASS |
| Exit-code contract | 0 matches / 1 no matches / 2 invalid args — tested | PASS |
| Runtime smoke | `node dist/cli.js /home/ubuntu/forge20 -p "CommitGrep" -a Raofal` returns real commits from this repo | PASS |
| Governance files | README, LICENSE (MIT), CHANGELOG, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, ADR 0001, architecture, ci-workflow, release-audit, discovery-notes, makefile, issue/PR templates, examples, .gitignore | PASS |
| Repository public | `gh repo edit --visibility public` — `private: false` | PASS |
| No secrets in history | `git log -p | grep -iE "password|secret|key"` — no credentials | PASS |

## Known limitations (documented, not hidden)

- Requires a local `git` binary; no pure-JS fallback (accepted trade-off, see ADR 0001).
- Pickaxe (`-S`) matches commits where the diff changes the occurrence count of the
  string; a string added and removed in the same commit matches. Documented behavior.
- Path filters are applied per-commit via `git log -- path ...`; results for
  renames/deletes follow `git`'s own heuristics.

## Conclusion

All gates pass; remaining constraints are documented. Release 1.0.0 is approved for
publication at https://github.com/raofal-msodeh/commitgrep.
