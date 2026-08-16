#!/usr/bin/env bash
# CommitGrep red-team: hostile inputs against a fixture repository.
set -u
TMPDIR_WORK="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_WORK"' EXIT

PASS=0
FAIL=0
NODE_CLI="$(cd "$(dirname "$0")/.." && pwd)/dist/cli.js"

expect() {
  local label="$1"
  local want="$2"
  local got="$3"
  if [ "$want" = "$got" ]; then
    PASS=$((PASS + 1))
    echo "PASS  $label (exit=$got)"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL  $label (want=$want got=$got)"
  fi
}

node_cli() {
  node "$NODE_CLI" "$@" > /dev/null 2> "$TMPDIR_WORK/err"
  local rc=$?
  echo "$rc"
}

# Fixture repository: three commits with distinct messages and files.
mkdir -p "$TMPDIR_WORK/repo"
cd "$TMPDIR_WORK/repo"
git init -q -b main
git config user.name "Ada Lovelace"
git config user.email "ada@example.com"
echo hello > a.txt
git add a.txt && git commit -q -m "initial commit"
echo secret > b.txt
git add b.txt && git commit -q -m "add secret config"
echo flag > c.txt
git add c.txt && git commit -q -m "Feat: add authentication"
cd "$TMPDIR_WORK"
ROOT="$TMPDIR_WORK/repo"

# 1. Non-repository root must exit 2
expect "non-repo root rejected" 2 "$(node_cli /tmp)"

# 2. Relative root must exit 2
expect "relative root rejected" 2 "$(node_cli relative-root -m x)"

# 3. Message regex with unbalanced brackets must exit 2
expect "unbalanced regex rejected" 2 "$(node_cli "$ROOT" -m '[unclosed')"

# 4. Invalid ISO date must exit 2
expect "invalid date rejected" 2 "$(node_cli "$ROOT" -m x --since not-a-date)"

# 5. Null byte in file filter must exit 2
printf 'a\x00b.txt' > "$TMPDIR_WORK/badpath"
expect "null byte path rejected" 2 "$(node_cli "$ROOT" -f "../escape")"

# 6. Absolute path filter must exit 2
expect "absolute path filter rejected" 2 "$(node_cli "$ROOT" -f /etc/passwd)"

# 7. Relative report path must exit 2
expect "relative report path rejected" 2 "$(node_cli "$ROOT" -m x -r rel.json)"

# 8. No matches must exit 1 with zero count
expect "no matches exits 1" 1 "$(node_cli "$ROOT" -m nonexistent-xyz)"

# 9. Matches must exit 0 and report file must be valid JSON
node_cli "$ROOT" -m "secret" -r "$TMPDIR_WORK/report.json" > /dev/null
expect "matches exits 0" 0 "$(node_cli "$ROOT" -m "secret")"
if [ -f "$TMPDIR_WORK/report.json" ] && python3 -c "import json,sys;json.load(open('$TMPDIR_WORK/report.json'))" 2>/dev/null; then
  PASS=$((PASS + 1)); echo "PASS  report file is valid JSON"
else
  FAIL=$((FAIL + 1)); echo "FAIL  report file is valid JSON"
fi

# 10. Empty repository must exit 1
mkdir -p "$TMPDIR_WORK/empty"
git init -q -b main "$TMPDIR_WORK/empty"
expect "empty repo exits 1" 1 "$(node_cli "$TMPDIR_WORK/empty" -m x)"

echo
echo "red-team summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
