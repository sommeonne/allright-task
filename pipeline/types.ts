export type Target = 'ui' | 'api';

export type TestCase = {
  /** File name without extension; used for the spec and the run folder. */
  slug: string;
  title: string;
  target: Target;
  steps: string[];
  expected: string;
  /** The case file as written, passed to the agents unchanged. */
  source: string;
};

export type PhaseStatus = 'passed' | 'failed' | 'skipped';

export type PhaseRecord = {
  phase: string;
  attempt: number;
  status: PhaseStatus;
  seconds: number;
  costUsd?: number;
  /** The model an agent phase ran on. Empty for phases the script runs itself. */
  model?: string;
  note: string;
};

export type Verdict =
  /** Lint and types clean, passes three times, fails when broken, no blocking review findings. */
  | 'VERIFIED'
  /** The application does not do what the case expects. The test was not bent to pass. */
  | 'CASE_MISMATCH'
  /** The retries ran out. */
  | 'NOT_GENERATED';
