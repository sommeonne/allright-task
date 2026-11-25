/**
 * Test-case pipeline: a text test case in, a verified Playwright test out.
 *
 *   bun run pipeline pipeline/cases/<name>.md
 *
 * Phases: intake → explore → generate → static checks → run → prove it can fail → review → report.
 * The agent phases are headless Claude Code sessions. Every pass/fail decision is made here,
 * by running lint, the type checker and the test itself; no agent grades its own work.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runAgent } from './agent';
import { readCase } from './case';
import { writeReport } from './report';
import { run, tail } from './shell';
import type { PhaseRecord, TestCase, Verdict } from './types';

const MAX_GENERATIONS = 3;

const casePath = process.argv[2];
if (!casePath) {
  console.error('Usage: bun run pipeline <path to a test case file>');
  process.exit(2);
}

const records: PhaseRecord[] = [];
const log = (record: PhaseRecord): void => {
  records.push(record);
  const cost =
    record.costUsd === undefined ? '' : `, ${record.model ?? ''} $${record.costUsd.toFixed(2)}`;
  console.log(
    `[${record.phase}${record.attempt > 1 ? ` #${record.attempt}` : ''}] ${record.status} ` +
      `(${record.seconds.toFixed(0)}s${cost}) ${record.note}`,
  );
};

// ---------------------------------------------------------------- 1. intake
let testCase: TestCase;
try {
  testCase = readCase(casePath);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

// The pipeline restores files when a case is rejected, so it must start from a clean tree.
const dirty = run('git', ['status', '--porcelain']).output;
if (dirty) {
  console.error(`Commit or stash your changes first. The working tree is not clean:\n${dirty}`);
  process.exit(2);
}

const specPath = `tests/${testCase.target}/bonus-tests/${testCase.slug}.spec.ts`;
const runDir = `pipeline/runs/${testCase.slug}`;
rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });
if (existsSync(specPath)) rmSync(specPath);
log({ phase: 'intake', attempt: 1, status: 'passed', seconds: 0, note: `${testCase.steps.length} steps, target ${testCase.target}` });

// --------------------------------------------------------------- 2. explore
const exploration = runAgent({
  agent: 'test-explorer',
  prompt: `Explore this test case in the real application and report what you find.\n\n${testCase.source}`,
  allowedTools: ['Read', 'Grep', 'Glob', 'Bash(curl:*)', 'mcp__playwright__*'],
});
writeFileSync(`${runDir}/exploration.md`, exploration.text);
const explored = exploration.verdict ?? 'UNKNOWN';
log({
  phase: 'explore',
  attempt: 1,
  status: exploration.ok && explored !== 'UNKNOWN' ? 'passed' : 'failed',
  seconds: exploration.seconds,
  costUsd: exploration.costUsd, model: exploration.model,
  note: `the explorer's finding: ${explored}`,
});

// ------------------------------------------------- 3–7. generate and verify
let verdict: Verdict = 'NOT_GENERATED';
let evidence = '';
let feedback = '';

for (let attempt = 1; attempt <= MAX_GENERATIONS; attempt++) {
  // 3. generate
  const generated = runAgent({
    agent: 'test-generator',
    canEdit: true,
    prompt: [
      `Write the Playwright test for this case at \`${specPath}\`.`,
      `\n## The case\n\n${testCase.source}`,
      `\n## What the explorer found in the real application\n\n${exploration.text}`,
      feedback ? `\n## Your previous attempt was rejected\n\n${feedback}` : '',
    ].join('\n'),
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash(bun run:*)'],
  });
  const wroteSpec = existsSync(specPath);
  log({
    phase: 'generate',
    attempt,
    status: generated.ok && wroteSpec ? 'passed' : 'failed',
    seconds: generated.seconds,
    costUsd: generated.costUsd, model: generated.model,
    note: wroteSpec ? specPath : 'no spec file was written',
  });
  if (!wroteSpec) {
    feedback = `No file exists at ${specPath}. Write the spec there.`;
    continue;
  }

  // Scope guard: the generator may add a spec and extend src/, never touch existing tests or config.
  const outOfScope = changedFiles().filter(
    (file) => file !== specPath && !file.startsWith('src/'),
  );
  if (outOfScope.length > 0) {
    run('git', ['checkout', '--', ...outOfScope.filter((file) => isTracked(file))]);
    log({ phase: 'scope', attempt, status: 'failed', seconds: 0, note: `reverted changes to ${outOfScope.join(', ')}` });
    feedback = `You changed files you must not touch: ${outOfScope.join(', ')}. They were reverted. Change only ${specPath} and files under src/.`;
    continue;
  }

  // 4. static checks
  const lint = run('bun', ['run', 'lint']);
  const types = run('bun', ['run', 'typecheck']);
  const staticOk = lint.ok && types.ok;
  log({ phase: 'static checks', attempt, status: staticOk ? 'passed' : 'failed', seconds: lint.seconds + types.seconds, note: staticOk ? 'lint and typecheck clean' : 'lint or typecheck failed' });
  if (!staticOk) {
    feedback = `Lint or typecheck failed:\n\n${tail(lint.ok ? types.output : lint.output)}`;
    continue;
  }

  // 5. run, three times
  const firstRun = runSpec(3);
  log({ phase: 'run', attempt, status: firstRun.ok ? 'passed' : 'failed', seconds: firstRun.seconds, note: firstRun.ok ? 'passed 3 of 3' : failureLine(firstRun.output) });
  if (!firstRun.ok) {
    if (explored === 'MISMATCH') {
      // The explorer predicted this: the application does not behave as the case expects.
      // Repairing the test here would mean bending it until it passes.
      verdict = 'CASE_MISMATCH';
      evidence = failureLine(firstRun.output);
      break;
    }
    feedback = `The test failed when run:\n\n${tail(firstRun.output)}`;
    continue;
  }

  // 6. prove it can fail: the verifier breaks one action, the pipeline runs the broken test.
  const original = readFileSync(specPath, 'utf8');
  const sabotage = runAgent({
    agent: 'test-verifier',
    canEdit: true,
    prompt: `Break one action in \`${specPath}\` as your instructions describe, then stop. Do not restore it.`,
    allowedTools: ['Read', 'Edit'],
  });
  const broken = readFileSync(specPath, 'utf8');
  const touchedAssertion = changedLines(original, broken).some((line) => line.includes('expect'));
  const brokenRun = broken === original || touchedAssertion ? undefined : runSpec(1);
  writeFileSync(specPath, original); // the pipeline restores the test, not the agent
  const provenNote =
    broken === original ? 'the verifier changed nothing'
    : touchedAssertion ? 'the verifier changed an assertion, which does not count'
    : brokenRun?.ok ? 'the broken test still passed: it cannot fail'
    : `fails when broken: ${failureLine(brokenRun?.output ?? '')}`;
  const proven = brokenRun !== undefined && !brokenRun.ok;
  log({ phase: 'prove it can fail', attempt, status: proven ? 'passed' : 'failed', seconds: sabotage.seconds + (brokenRun?.seconds ?? 0), costUsd: sabotage.costUsd, model: sabotage.model, note: provenNote });
  if (!proven) {
    feedback = `The test could not be shown to fail (${provenNote}). Its assertions must depend on the actions in the test.`;
    continue;
  }
  const restoredRun = runSpec(1);
  if (!restoredRun.ok) {
    feedback = `After restoring the file the test failed:\n\n${tail(restoredRun.output)}`;
    log({ phase: 'run after restore', attempt, status: 'failed', seconds: restoredRun.seconds, note: failureLine(restoredRun.output) });
    continue;
  }
  evidence = provenNote;

  // 7. review by the repository's read-only reviewer agent
  const review = runAgent({
    agent: 'test-reviewer',
    prompt: `Changed files to review:\n${changedFiles().map((file) => `- ${file}`).join('\n')}\n\nThe test was generated from this case; check that it asserts the expected result as written.\n\n${testCase.source}`,
    allowedTools: ['Read', 'Grep', 'Glob'],
  });
  writeFileSync(`${runDir}/review-${attempt}.md`, review.text);
  const blocking = /^Blocking\s*$/m.test(review.text);
  log({ phase: 'review', attempt, status: blocking ? 'failed' : 'passed', seconds: review.seconds, costUsd: review.costUsd, model: review.model, note: blocking ? 'blocking findings' : 'no blocking findings' });
  if (blocking && attempt < MAX_GENERATIONS) {
    feedback = `The reviewer has blocking findings:\n\n${review.text}`;
    continue;
  }
  if (!blocking) verdict = 'VERIFIED';
  break;
}

// ---------------------------------------------------------------- 8. report
if (verdict !== 'VERIFIED') {
  // A rejected test must not stay in the suite. Keep it with the run for inspection,
  // as a text file so that neither the type checker nor ESLint picks it up.
  if (existsSync(specPath)) renameSync(specPath, `${runDir}/rejected.spec.ts.txt`);
  const tracked = changedFiles().filter((file) => isTracked(file));
  if (tracked.length > 0) run('git', ['checkout', '--', ...tracked]);
  run('git', ['clean', '-fdq', 'src', dirname(specPath)]);
}

const reportPath = writeReport({ testCase, verdict, evidence, records, specPath, runDir });
console.log(`\n${verdict} — report: ${reportPath}`);
process.exit(verdict === 'VERIFIED' ? 0 : 1);

// ------------------------------------------------------------------ helpers
function runSpec(repeat: number) {
  return run('bun', ['run', 'test', specPath, `--project=${testCase.target}`, `--repeat-each=${repeat}`, '--reporter=line']);
}

/** Paths that differ from the last commit, including new files. */
function changedFiles(): string[] {
  return run('git', ['status', '--porcelain', '--untracked-files=all'])
    .output.split('\n')
    .map((line) => /^\s*\S{1,2}\s+(.+)$/.exec(line)?.[1]?.trim() ?? '')
    .filter((file) => file && !file.startsWith('pipeline/runs/'));
}

function isTracked(file: string): boolean {
  return run('git', ['ls-files', '--error-unmatch', file]).ok;
}

/** Lines present in one version and not the other. */
function changedLines(before: string, after: string): string[] {
  const a = before.split('\n');
  const b = after.split('\n');
  return [...a.filter((line) => !b.includes(line)), ...b.filter((line) => !a.includes(line))];
}

/** The first assertion or error line of a Playwright run, for the report. */
function failureLine(output: string): string {
  const lines = output.split('\n').map((line) => line.trim());
  const start = lines.findIndex((line) => line.startsWith('Error:'));
  if (start === -1) return lines.filter(Boolean).slice(-1)[0] ?? 'no output';
  const detail = lines.slice(start + 1, start + 12).filter((line) => /^(Expected|Received|[-+] )/.test(line));
  return [lines[start], ...detail.slice(0, 2)].join(' | ').slice(0, 300);
}
