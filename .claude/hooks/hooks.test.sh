#!/usr/bin/env bash
# Tests for the agent hooks. Run: bash .claude/hooks/hooks.test.sh
# Each case pipes a hook payload into a hook and checks the exit code
# (0 = nothing to say, 2 = feed stderr back to the agent).
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1
export CLAUDE_PROJECT_DIR="$ROOT"

LINT="$ROOT/.claude/hooks/lint-edited.sh"
TYPECHECK="$ROOT/.claude/hooks/typecheck.sh"

CLEAN="$ROOT/tests/ui/hook-probe-clean.spec.ts"
BAD="$ROOT/tests/ui/hook-probe-bad.spec.ts"
SPACED="$ROOT/tests/ui/hook probe spaced.spec.ts"
TYPE_ERR="$ROOT/tests/ui/hook-probe-type-error.ts"
NO_AWAIT="$ROOT/tests/ui/hook-probe-no-await.spec.ts"
STDERR_FILE="$(mktemp)"
OUTSIDE_DIR="$(mktemp -d)"
OUTSIDE="$OUTSIDE_DIR/outside.spec.ts"   # a real, bad file that is not in the project

cleanup() { rm -f "$CLEAN" "$BAD" "$SPACED" "$NO_AWAIT" "$TYPE_ERR" "$STDERR_FILE"; rm -rf "$OUTSIDE_DIR"; }
trap cleanup EXIT

cat > "$CLEAN" <<'TS'
import { expect, test } from '@playwright/test';

test('clean probe', async ({ page }) => {
  await expect(page).toHaveURL(/.*/);
});
TS

cat > "$BAD" <<'TS'
import { expect, test } from '@playwright/test';

test('bad probe', async ({ page }) => {
  await page.waitForTimeout(1);
  await expect(page).toHaveURL(/.*/);
});
TS
cp "$BAD" "$SPACED"

cat > "$NO_AWAIT" <<'TS'
import { expect, test } from '@playwright/test';

test('missing await probe', async ({ page }) => {
  page.goto('/');
  await expect(page).toHaveURL(/.*/);
});
TS
cp "$BAD" "$OUTSIDE"

failures=0

# run_case <name> <hook> <payload> <expected exit> [<text expected in stderr>]
run_case() {
  local name="$1" hook="$2" payload="$3" want="$4" grep_for="${5:-}"
  local got
  printf '%s' "$payload" | bash "$hook" 2>"$STDERR_FILE" >/dev/null
  got=$?
  if [ "$got" -ne "$want" ]; then
    echo "FAIL $name (exit $got, expected $want)"; failures=$((failures + 1)); return
  fi
  if [ -n "$grep_for" ] && ! grep -q "$grep_for" "$STDERR_FILE"; then
    echo "FAIL $name (stderr lacks '$grep_for')"; failures=$((failures + 1)); return
  fi
  echo "ok   $name"
}

payload() { printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$1"; }

run_case "1 lint: clean .ts file"            "$LINT" "$(payload "$CLEAN")" 0
run_case "2 lint: file with waitForTimeout"  "$LINT" "$(payload "$BAD")" 2 "no-wait-for-timeout"
run_case "2b lint: missing await"            "$LINT" "$(payload "$NO_AWAIT")" 2 "no-floating-promises"
run_case "3 lint: non-.ts file"              "$LINT" "$(payload "$ROOT/README.md")" 0
run_case "4 lint: .ts outside the project"   "$LINT" "$(payload "$OUTSIDE")" 0
run_case "5 lint: file does not exist"       "$LINT" "$(payload "$ROOT/tests/ui/missing.spec.ts")" 0
run_case "6 lint: path with spaces"          "$LINT" "$(payload "$SPACED")" 2 "no-wait-for-timeout"
run_case "7 lint: empty payload"             "$LINT" "{}" 0
HOOK_NODE_MODULES=/nonexistent \
run_case "8 lint: node_modules missing"      "$LINT" "$(payload "$BAD")" 0

rm -f "$BAD" "$SPACED" "$NO_AWAIT"   # keep the tree type-clean and lint-clean for the typecheck cases
run_case "9 typecheck: clean tree"           "$TYPECHECK" '{"stop_hook_active":false}' 0
printf "export const n: number = 'x';\n" > "$TYPE_ERR"
run_case "10 typecheck: type error"          "$TYPECHECK" '{"stop_hook_active":false}' 2 "TS2322"
run_case "11 typecheck: already continuing"  "$TYPECHECK" '{"stop_hook_active":true}' 0

if [ "$failures" -gt 0 ]; then
  echo "$failures case(s) failed"; exit 1
fi
echo "all hook cases passed"
