# AI worklog

The instructions and prompts I gave the AI agent (Claude Code) for this task, and five places where it was wrong.

## How I worked: superpowers for the process, my own harness for the tests

I used [superpowers](https://github.com/obra/superpowers), a workflow plugin for Claude Code, to run the process. It does not write tests. It makes the agent work in a fixed order:

1. discuss the idea with me and agree on a design before touching code;
2. write the design down and turn it into a step-by-step plan;
3. implement the plan one task at a time, proving each step with a command and its output;
4. hand the result to a fresh agent for review.

I used this order to build the harness described below. The design was also reviewed by a separate agent before any file was written, and that review changed it in 14 places. For the later work (API tests, UI tests, CI) a test list agreed in chat was enough, followed by the same implement, prove and review steps.

Superpowers is not part of this repository and is not needed to use it. Its rules are general-purpose, and some do not fit a test-automation project (see mistake 1). So the harness here stands on its own: clone the repo, open it in plain Claude Code, and the files below are loaded.

## Instructions and prompts for the agent

The agent was not steered by one-off chat prompts. Its prompts are the files below: it loads them itself, so every test was written under the same instructions.

| File                                                                                | What it does                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                                            | Rules that apply everywhere: selectors, no sleeps, layering, test data, the bug policy, "prove the test can fail", the definition of done                              |
| [`.claude/skills/ui-playwright/SKILL.md`](.claude/skills/ui-playwright/SKILL.md)    | How to write a UI test here: workflow, page-object and component patterns, and a table of facts about saucedemo verified in a real browser                             |
| [`.claude/skills/api-testing/SKILL.md`](.claude/skills/api-testing/SKILL.md)        | How to write an API test here: client contract, schemas, fixtures, and a table of every restful-booker response verified with live calls                               |
| [`.claude/agents/test-reviewer.md`](.claude/agents/test-reviewer.md)                | A read-only reviewer agent. It checks what lint cannot: weak assertions, tests that depend on each other, negative tests that are not negative, unsupported bug claims |
| [`.claude/settings.json`](.claude/settings.json), [`.claude/hooks/`](.claude/hooks) | After every edit the agent's file is linted and errors are fed back to it; when it stops, the project is type-checked. The hooks have their own tests                  |
| [`eslint.config.mjs`](eslint.config.mjs)                                            | The mechanical rules: no `waitForTimeout`, no missing `await`, no locators or API calls inside specs, no skipped tests                                                 |
| [`.mcp.json`](.mcp.json)                                                            | Playwright MCP server: gives the agent a real browser, so it reads selectors from the page and does not invent them                                                    |

## Where the agent was wrong

### Mistake 1 — It stacked two rule systems and patched the conflicts

**What happened.** The agent's first design made the repository's harness depend on superpowers, and then listed six adjustments to override the plugin's defaults: its strict "unit test first" rule, its generic reviewer, a fallback for when it is not installed.

**How I noticed.** Reading the proposal. Six patches to make two sets of instructions coexist is a sign the design is wrong, and a rule such as "no code without a failing unit test first" makes no sense in a repository where the tests are the product.

**Fix.** The harness in this repository is self-contained. The ideas worth keeping were rewritten for test code: see the test fail once, show command output before saying "done", review by a fresh agent.

### Mistake 2 — Its tool for checking selectors could not see what negative tests need

**What happened.** To back the rule "never invent a selector", the agent planned a custom script that prints a page's `data-test` attributes. It also dismissed the Playwright MCP server as "a dependency reviewers would have to install".

**How I noticed.** I asked how exactly it would collect the locators. Explaining it, the agent had to admit the script only sees a page's initial state: an error message after a failed login, or a "Remove" button after adding a product, would never be captured. Those are exactly the elements negative tests assert on. The dependency argument was also wrong: the server is one committed file started with `bunx`.

**Fix.** The script was dropped for the Playwright MCP server. The UI skill's table now lists ids per page *and per state*.

### Mistake 3 — It reported its own assumptions as bugs

**What happened.** The first API suite had two "bugs" with failing tests and bug reports: creating a booking without a first name "should answer 400" (it answers 500), and a wrong password "should answer 401" (it answers 200).

**How I noticed.** I asked whether those expected values are in the API documentation. They are not: the documentation describes success responses only. 400 and 401 were the agent's own choice, taken from HTTP convention and presented as requirements.

**Fix.** Both were removed as bugs and are listed as design issues. Their tests now assert what the documentation does support (a booking without a required field is not created; a wrong password returns no token). The bug policy in `CLAUDE.md` and the API skill was rewritten: a bug must quote the sentence it contradicts. Every bug report in the README has a "Source of the expectation" line.

### Mistake 4 — "Lint enforces this" was not true

**What happened.** `CLAUDE.md` said lint enforces the rule that specs never build locators or call the API directly, and the reviewer agent was told to skip whatever lint covers. The lint rule matched only the literal forms `page.getByTestId(...)` and `request.get(...)`.

**How it was caught.** By the final review of the harness, done by a fresh agent that wrote probe files instead of reading the config. `async ({ request: api })`, `page.request.get()`, `const p = page; p.getByTestId()` and `const { getByRole } = page` all passed lint. A page object containing a sleep and a CSS locator also passed, because the Playwright rules did not cover `src/`.

**Fix.** The selectors match by property name on any object and cover aliases; the rules apply to `src/` too; the same probe went from 0 errors to 9. `CLAUDE.md` now says lint catches the usual forms and the reviewer checks the rest.

### Mistake 5 — A "proof" that proved nothing

**What happened.** To prove a new test could fail, the agent swapped a wrong password for the right one with a `sed` command written for Linux. On macOS the command changed nothing. The unchanged test ran and passed.

**How it was caught.** The output said `2 passed`. A deliberately broken test must not pass, and the agent stopped on that instead of recording the step as done. Redone properly, the test failed with `Expected: false, Received: true`.

**What it shows.** "I checked that it fails" is only evidence when the failure line is shown. That is why the definition of done asks for command output.
