import { spawnSync } from 'node:child_process';

export type AgentResult = {
  ok: boolean;
  /** The agent's final message. */
  text: string;
  /** The value after "VERDICT:" on the last such line, if any. */
  verdict: string | undefined;
  seconds: number;
  costUsd: number;
  model: string;
};

type AgentOptions = {
  /** Name of an agent defined in .claude/agents. */
  agent: string;
  prompt: string;
  /** Tools the agent may use without asking. Anything else is denied in headless mode. */
  allowedTools: string[];
  /** Whether file edits are accepted. Read-only phases leave this off. */
  canEdit?: boolean;
};

/**
 * Which model each agent runs on. The two phases where quality decides the outcome
 * (writing the test, reviewing it) get the stronger model; the two mechanical ones
 * (walking the steps, breaking one action) get the faster one.
 */
const HARD = process.env.PIPELINE_MODEL_HARD ?? 'opus';
const EASY = process.env.PIPELINE_MODEL_EASY ?? 'sonnet';

const modelByAgent: Record<string, string> = {
  'test-explorer': EASY,
  'test-generator': HARD,
  'test-verifier': EASY,
  'test-reviewer': HARD,
};

export function modelFor(agent: string): string {
  return modelByAgent[agent] ?? EASY;
}

/**
 * Runs one phase as a separate headless Claude Code session inside this repository.
 * The session loads the repository's own CLAUDE.md, skills, hooks and agents
 * (`--setting-sources project`), and nothing from the user's personal setup.
 */
export function runAgent(options: AgentOptions): AgentResult {
  const started = Date.now();
  const model = modelFor(options.agent);
  const args = [
    '-p',
    options.prompt,
    '--agent',
    options.agent,
    '--model',
    model,
    '--output-format',
    'json',
    '--setting-sources',
    'project',
    '--mcp-config',
    '.mcp.json',
    '--no-session-persistence',
    '--permission-mode',
    options.canEdit ? 'acceptEdits' : 'default',
    '--allowedTools',
    ...options.allowedTools,
  ];
  const result = spawnSync('claude', args, {
    encoding: 'utf8',
    timeout: 20 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = (Date.now() - started) / 1000;

  try {
    const parsed = JSON.parse(result.stdout) as {
      result?: string;
      is_error?: boolean;
      total_cost_usd?: number;
    };
    const text = parsed.result ?? '';
    const verdicts = [...text.matchAll(/^VERDICT:\s*(\S+)/gm)];
    return {
      ok: result.status === 0 && parsed.is_error !== true,
      text,
      verdict: verdicts.at(-1)?.[1],
      seconds,
      costUsd: parsed.total_cost_usd ?? 0,
      model,
    };
  } catch {
    return {
      ok: false,
      text: `The headless session did not return JSON.\n${result.stdout}\n${result.stderr}`,
      verdict: undefined,
      seconds,
      costUsd: 0,
      model,
    };
  }
}
