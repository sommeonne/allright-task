import { writeFileSync } from 'node:fs';
import type { PhaseRecord, TestCase, Verdict } from './types';

type ReportInput = {
  testCase: TestCase;
  verdict: Verdict;
  evidence: string;
  records: PhaseRecord[];
  specPath: string;
  runDir: string;
};

const meaning: Record<Verdict, string> = {
  VERIFIED:
    'Lint and types are clean, the test passed three times, it failed when one action was broken, and the reviewer has no blocking findings.',
  CASE_MISMATCH:
    'The application does not do what the case expects. The test asserts the expected result as written, so it fails; it was not changed to pass and was not added to the suite.',
  NOT_GENERATED: 'The retries ran out before a test passed every phase. Nothing was added to the suite.',
};

/** Phase 8 — report. Writes what happened in each phase and returns the report's path. */
export function writeReport(input: ReportInput): string {
  const { testCase, verdict, evidence, records, specPath, runDir } = input;
  const totalSeconds = records.reduce((sum, record) => sum + record.seconds, 0);
  const totalCost = records.reduce((sum, record) => sum + (record.costUsd ?? 0), 0);
  const generations = records.filter((record) => record.phase === 'generate').length;

  const rows = records
    .map(
      (record) =>
        `| ${record.phase} | ${record.attempt} | ${record.status} | ${record.model ?? 'script'} | ` +
        `${record.seconds.toFixed(0)} s | ${record.costUsd === undefined ? '' : `$${record.costUsd.toFixed(2)}`} | ` +
        `${record.note.replaceAll('|', '\\|')} |`,
    )
    .join('\n');

  const report = `# ${testCase.title}

**Verdict: ${verdict}.** ${meaning[verdict]}

- Case: \`pipeline/cases/${testCase.slug}.md\` (target: ${testCase.target})
- Test: ${verdict === 'VERIFIED' ? `\`${specPath}\`` : `not added; the rejected attempt is in \`${runDir}/rejected.spec.ts.txt\``}
- Generation attempts: ${generations}
- Evidence: ${evidence || 'none'}
- Total: ${(totalSeconds / 60).toFixed(1)} min; usage about $${totalCost.toFixed(2)} at API prices (on a subscription this counts against the plan, it is not billed)

| Phase | Attempt | Status | Run by | Time | Usage (API-price estimate) | Note |
|---|---|---|---|---|---|---|
${rows}
`;
  const path = `${runDir}/report.md`;
  writeFileSync(path, report);
  return path;
}
