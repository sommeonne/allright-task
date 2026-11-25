# CLAUDE.md

## Project

Test automation for a QA test task, written with Playwright + TypeScript.
- UI: https://www.saucedemo.com (project `ui`, tests in `tests/ui`, code in `src/ui`)
- API: https://restful-booker.herokuapp.com (project `api`, tests in `tests/api`, code in `src/api`)

## Commands

Everything runs on Bun (`bunfig.toml` makes `bun run` use Bun for the tools too). Do not use `npm`, `npx` or `node`.

- `bun run test` — everything. `bun run test:ui`, `bun run test:api` — one project.
- `bun run test <file> --project=<ui|api>` — one file.
- `bun run lint`, `bun run typecheck`.
- `bash .claude/hooks/hooks.test.sh` — tests for the hooks themselves.

## Skills (load before you touch the code)

- Before reading or changing anything in `tests/ui` or `src/ui`, load the `ui-playwright` skill.
- Before reading or changing anything in `tests/api` or `src/api`, load the `api-testing` skill.

The skills hold the workflow, the patterns and the verified facts about each application. This file holds only what applies everywhere.

## Rules

- **Selectors:** `getByTestId` (configured to `data-test`) or role/label locators. No CSS or XPath.
- **Waiting:** web-first `expect` assertions only. No `waitForTimeout`, no sleeps.
- **Layers:** specs never build locators and never call `request`. UI goes through page objects, API goes through clients. Lint catches the usual forms; the reviewer checks the rest.
- **Data:** every test creates what it needs and cleans it up through a fixture. No test depends on another.
- **Facts:** never invent a selector, a message, a status or an API field. UI: check the skill's table, or open the page in the Playwright MCP browser and read the real id. API: check the skill's table, or read the apidoc and make one real call. Add what you verify to the skill's table.
- **Lint and types run automatically:** ESLint after each edit of a `.ts` file, `tsc` when you finish (it reports once, then lets you stop: run `bun run typecheck` yourself before reporting done). Fix what they report. An `eslint-disable` comment needs a one-line reason next to it.
- **Pre-commit:** husky runs `eslint --fix` on staged `.ts` files (lint-staged). Warnings fail too. Do not bypass it with `--no-verify`.

## Oracle and bug policy

The oracle is the apidoc (API) and the obvious user requirement (UI). An expectation you cannot trace to the oracle is your assumption, not a requirement.

- **BUG** — the behaviour contradicts a statement you can quote from the oracle (API: a sentence, a field type or a "required" mark in the apidoc). Keep the correct assertion, mark the test `test.fail()` with a `// BUG-nn: ...` comment and the `@known-bug` tag, and write a README bug report (ID, title, source of the expectation, steps, expected, actual, evidence).
- **DESIGN** — questionable behaviour the oracle does not cover or itself documents (DELETE answers 201; a missing required field answers 500; a failed login answers 200). The apidoc documents no error responses, so an "expected" error status is a convention, not a requirement. Assert the behaviour as observed (the exact status the server returns) with a `// DESIGN-nn: ...` comment, and list it in the README as a design issue. No `test.fail()`. Never assert as "expected" a status the server does not return and the oracle never promised.
- An undocumented status that is simply how the API works (a missing booking answers 404) may be asserted with an `// observed, undocumented` comment.
- **Unsure which:** ask. Do not choose the option that makes the test green.
- Never delete or weaken an assertion to make a test pass.

## When a test fails

Find the root cause first, then act on which kind it is:
1. **Test bug** — fix the test.
2. **Environment** (public service down, slow, reset) — say so in the report; do not hide it with retries or longer timeouts.
3. **Product bug** — apply the bug policy above.

## Prove the test can fail

For every test with a non-trivial assertion: break the action or the precondition once (skip the step, use another item, send another id), confirm the test fails on the intended assertion, restore it, and include the failure line in your report. Changing the expected value does not count.

## Definition of done (per phase)

Do not report a phase as done without the output of:
1. `bun run test --project=<ui|api> --repeat-each=3` — all green, run once at the end.
2. `bun run lint` and `bun run typecheck` — clean.
3. The `test-reviewer` agent run on the changed files — Blocking findings fixed, the rest answered.

Report what you ran and what it printed. "Should pass" is not a result.

## Worklog

When a mistake of yours is caught (by lint, a failing run, the reviewer, or the author), add an entry to `docs/worklog-notes.md` right away: what happened, what caught it, the fix. It is a local scratch file and is not committed; `AI_WORKLOG.md` is written from it.
