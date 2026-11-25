#!/usr/bin/env bash
# Stop hook: type-check the project when the agent is about to finish.
# Runs here, not after every edit, because the tree is often inconsistent mid-change.
# Input:  hook payload as JSON on stdin; stop_hook_active is true when the agent
#         is already continuing because of a stop hook (guards against a loop).
# Output: exit 0 = nothing to say; exit 2 = stderr is fed back and the agent continues.
set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$ROOT" ] && cd "$ROOT" 2>/dev/null || exit 0

NODE_MODULES="${HOOK_NODE_MODULES:-$ROOT/node_modules}"
TSC="$NODE_MODULES/.bin/tsc"
command -v bun >/dev/null 2>&1 || exit 0   # Bun not installed: do not block
[ -x "$TSC" ] || exit 0             # dependencies not installed yet: do not block

ACTIVE="$(bun -e '
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    try { process.stdout.write(String(JSON.parse(raw).stop_hook_active === true)); } catch { /* not JSON */ }
  });
' 2>/dev/null)"
[ "$ACTIVE" = "true" ] && exit 0

if ! OUTPUT="$(bun --bun "$TSC" --noEmit 2>&1)"; then
  {
    echo "TypeScript errors. Fix them before finishing:"
    echo "$OUTPUT"
  } >&2
  exit 2
fi
exit 0
