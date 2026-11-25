import { spawnSync } from 'node:child_process';

export type CommandResult = { ok: boolean; output: string; seconds: number };

/** Runs a command in the repository root and captures everything it prints. */
export function run(command: string, args: string[], timeoutMs = 10 * 60_000): CommandResult {
  const started = Date.now();
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '', FORCE_COLOR: '0' },
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
    seconds: (Date.now() - started) / 1000,
  };
}

/** The last lines of a long output: enough for an agent to see what failed. */
export function tail(text: string, lines = 60): string {
  return text.split('\n').slice(-lines).join('\n');
}
