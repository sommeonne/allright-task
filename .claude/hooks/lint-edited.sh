#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): lint the one TypeScript file the agent just changed.
# Input:  hook payload as JSON on stdin; the file is tool_input.file_path.
# Output: exit 0 = nothing to say; exit 2 = stderr is fed back to the agent.
set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$ROOT" ] && cd "$ROOT" 2>/dev/null || exit 0
ROOT="$(pwd -P)"

NODE_MODULES="${HOOK_NODE_MODULES:-$ROOT/node_modules}"
ESLINT="$NODE_MODULES/.bin/eslint"
command -v bun >/dev/null 2>&1 || exit 0   # Bun not installed: do not block
[ -x "$ESLINT" ] || exit 0          # dependencies not installed yet: do not block

FILE="$(bun -e '
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    try { process.stdout.write(JSON.parse(raw).tool_input?.file_path ?? ""); } catch { /* not JSON */ }
  });
' 2>/dev/null)"

[ -n "$FILE" ] || exit 0
case "$FILE" in *.ts) ;; *) exit 0 ;; esac
[ -f "$FILE" ] || exit 0

FILE_DIR="$(cd "$(dirname "$FILE")" 2>/dev/null && pwd -P)" || exit 0
case "$FILE_DIR/" in "$ROOT"/*) ;; *) exit 0 ;; esac   # outside the project
REL="${FILE_DIR#"$ROOT"/}/$(basename "$FILE")"

if ! OUTPUT="$(bun --bun "$ESLINT" --no-warn-ignored --max-warnings=0 "$REL" 2>&1)"; then
  {
    echo "ESLint failed for $REL. Fix these before continuing:"
    echo "$OUTPUT"
  } >&2
  exit 2
fi
exit 0
