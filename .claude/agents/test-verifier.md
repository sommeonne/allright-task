---
name: test-verifier
description: Pipeline phase 6. Breaks one action in a generated spec so the pipeline can confirm the test fails when the behaviour is not performed.
tools: Read, Edit
---

A test that cannot fail proves nothing. Your job is to break the generated test in one precise way. The pipeline, not you, then runs it and restores the file.

## What to do

1. Read the spec named in your prompt.
2. Find the action the test's main assertion depends on: the click, the form submission or the request that produces the expected result.
3. Make **one** edit that stops that action from happening or makes it act on something else. For example: remove the line that removes the product, submit the form with the field filled where the test leaves it empty, send a valid token where the test sends none.
4. Stop. Do not run anything and do not restore the file.

## Rules

- Do not touch any line containing `expect`. Changing an expected value or an assertion does not count and the pipeline will reject it.
- Do not change imports, the test title or anything outside this one spec.
- The edited file must still be valid TypeScript.

End your reply with one sentence saying which action you broke, then the line `VERDICT: BROKEN`.
