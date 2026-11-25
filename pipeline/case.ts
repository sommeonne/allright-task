import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { Target, TestCase } from './types';

/**
 * Phase 1 — intake. Reads a case file and refuses anything the later phases cannot work with.
 *
 * Expected format:
 *
 *   # Title of the case
 *   Target: ui            (or: api)
 *   ## Steps
 *   1. First step
 *   2. Second step
 *   ## Expected result
 *   What must be true at the end.
 */
export function readCase(path: string): TestCase {
  const source = readFileSync(path, 'utf8');
  const problems: string[] = [];

  const title = /^#\s+(.+)$/m.exec(source)?.[1]?.trim() ?? '';
  if (!title) problems.push('no title (a line starting with "# ")');

  const targetText = /^Target:\s*(\S+)/im.exec(source)?.[1]?.toLowerCase();
  if (targetText !== 'ui' && targetText !== 'api') {
    problems.push('no target (a line "Target: ui" or "Target: api")');
  }

  const steps = section(source, 'Steps')
    .split('\n')
    .map((line) => /^\s*(?:\d+[.)]|[-*])\s+(.+)$/.exec(line)?.[1]?.trim())
    .filter((step): step is string => Boolean(step));
  if (steps.length === 0) problems.push('no steps (a numbered list under "## Steps")');

  const expected = section(source, 'Expected result').trim();
  if (!expected) problems.push('no expected result (text under "## Expected result")');

  if (problems.length > 0) {
    throw new Error(`${path} is not a usable test case:\n- ${problems.join('\n- ')}`);
  }

  const slug = basename(path).replace(/\.[^.]+$/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Case file name "${slug}" must be lowercase letters, digits and dashes.`);
  }

  return { slug, title, target: targetText as Target, steps, expected, source };
}

/** The text between "## <name>" and the next "## " heading. */
function section(source: string, name: string): string {
  const pattern = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'im');
  return pattern.exec(source)?.[1] ?? '';
}
