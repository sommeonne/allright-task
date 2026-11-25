# Bonus: from a text test case to a verified Playwright test

A pipeline that takes a manual test case written as text (steps and an expected result) and produces a Playwright test that has been checked, not just written.

```bash
bun run pipeline pipeline/cases/<name>.md
```

It needs [Claude Code](https://claude.com/claude-code) installed and logged in. The agent phases are headless `claude -p` sessions; on a subscription login they count against the plan, and with `ANTHROPIC_API_KEY` set they are billed per token.

## The input

One Markdown file per case:

```markdown
# Checkout cannot continue without a postal code

Target: ui

## Steps

1. Log in as standard_user.
2. Add "Sauce Labs Backpack" to the cart.
3. Open the cart and press Checkout.
4. Enter first name "Olena" and last name "Tester". Leave the postal code empty.
5. Press Continue.

## Expected result

The message "Error: Postal Code is required" is shown, and the user stays on the "Checkout: Your Information" step.
```

`Target` is `ui` (saucedemo) or `api` (restful-booker).

## The phases

| #   | Phase             | Run by                                     | What it does                                                                                                                                                                                                   |
| --- | ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Intake            | script                                     | Checks the case has a title, a target, steps and an expected result. Refuses to start on uncommitted changes.                                                                                                  |
| 2   | Explore           | agent `test-explorer`, Sonnet, read-only   | Performs the steps in the real application through the Playwright MCP browser. Reports the element ids it found and whether the application shows the expected result: `EXECUTABLE`, `MISMATCH` or `BLOCKED`.  |
| 3   | Generate          | agent `test-generator`, Opus               | Writes one spec from the case and the explorer's report, under this repository's `CLAUDE.md` and skills. Must assert the expected result as written.                                                           |
| —   | Scope guard       | script                                     | The generator may add the spec and extend `src/`. A change to any existing test or config is reverted and sent back.                                                                                           |
| 4   | Static checks     | script                                     | `bun run lint` and `bun run typecheck`.                                                                                                                                                                        |
| 5   | Run               | script                                     | Runs the new test three times.                                                                                                                                                                                 |
| 6   | Prove it can fail | agent `test-verifier`, Sonnet, then script | The agent breaks one action in the test and stops. The script rejects the edit if it touched an `expect` line, runs the broken test (it must fail), restores the file itself and runs it again (it must pass). |
| 7   | Review            | agent `test-reviewer`, Opus, read-only     | The same reviewer the rest of the suite went through. A blocking finding sends the test back.                                                                                                                  |
| 8   | Report            | script                                     | Writes `pipeline/runs/<name>/report.md`: every phase, its attempts, time and usage.                                                                                                                            |

A failure in phases 4 to 7 goes back to phase 3 with the error, for at most three generations in total.

**The script makes every pass/fail decision.** No agent grades its own work: lint, the type checker and the test run decide. The agents are defined in [`.claude/agents/`](.claude/agents); the runner is in [`pipeline/`](pipeline).

**Two models.** Writing the test and reviewing it decide the quality of the result, so they run on Opus. Walking the steps and breaking one action are mechanical, so they run on Sonnet. `PIPELINE_MODEL_HARD` and `PIPELINE_MODEL_EASY` override this.

## The three outcomes

| Verdict         | Meaning                                                                                    | What happens to the test                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `VERIFIED`      | Lint and types clean, passed three times, failed when broken, no blocking review findings. | Stays in `tests/<target>/bonus-tests/`.                                                        |
| `CASE_MISMATCH` | The application does not do what the case expects.                                         | Not added to the suite. The failing attempt is kept in the run folder, and `src/` is restored. |
| `NOT_GENERATED` | The retries ran out.                                                                       | Same as above.                                                                                 |

`CASE_MISMATCH` is the outcome that matters most. When a generated test fails, the easy way out for an agent is to change the expectation until it passes. Here the explorer's finding stops the repair loop, and the pipeline reports the disagreement between the case and the application.

## Examples

All three ran on 2026-11-25. Times and usage are from the pipeline's own reports; usage is Claude Code's estimate at API prices.

| Case                                                                                                  | Verdict         | Generations | Time    | Usage | Fixed by hand                             |
| ----------------------------------------------------------------------------------------------------- | --------------- | ----------- | ------- | ----- | ----------------------------------------- |
| [Removing one of two products leaves the other in the cart](pipeline/cases/cart-remove-one-of-two.md) | `VERIFIED`      | 1           | 2.0 min | $0.66 | nothing                                   |
| [Checkout cannot continue without a postal code](pipeline/cases/checkout-postal-code-required.md)     | `VERIFIED`      | 1           | 2.2 min | $0.67 | nothing                                   |
| [Sorting by price from high to low…](pipeline/cases/sort-price-high-to-low.md) (wrong on purpose)     | `CASE_MISMATCH` | 1           | 1.3 min | $0.31 | nothing; the case itself needs correcting |

### Example 1 — verified

**Input:** [`pipeline/cases/cart-remove-one-of-two.md`](pipeline/cases/cart-remove-one-of-two.md): add the Backpack and the Bike Light, open the cart, remove the Backpack. Expected: the cart lists only the Bike Light and the badge shows 1.

**Generated:** [`tests/ui/bonus-tests/cart-remove-one-of-two.spec.ts`](tests/ui/bonus-tests/cart-remove-one-of-two.spec.ts)

```ts
test('removing one of two products leaves the other in the cart', async ({
  inventoryPage,
  cartPage,
}) => {
  await inventoryPage.open();
  await inventoryPage.product(backpack.name).addButton.click();
  await inventoryPage.product(bikeLight.name).addButton.click();
  await expect(inventoryPage.header.cartBadge).toHaveText('2');

  await inventoryPage.header.openCart();
  await cartPage.expectLoaded();
  await expect(cartPage.itemNames).toHaveText([backpack.name, bikeLight.name]);

  await cartPage.item(backpack.name).removeButton.click();

  await expect(cartPage.itemNames).toHaveText([bikeLight.name]);
  await expect(cartPage.header.cartBadge).toHaveText('1');
});
```

**Did it pass:** yes, 3 of 3. With the removal broken by the verifier it failed on `expect(locator).toHaveText(expected)`: one more item than expected. Reviewer: "No findings."

**Fixed by hand:** nothing. It reuses the existing page objects, the `CartItem` component and the pinned products, and adds no new code to `src/`.

### Example 2 — verified, and it extended the shared code

**Input:** [`pipeline/cases/checkout-postal-code-required.md`](pipeline/cases/checkout-postal-code-required.md), shown above.

**Generated:** [`tests/ui/bonus-tests/checkout-postal-code-required.spec.ts`](tests/ui/bonus-tests/checkout-postal-code-required.spec.ts)

```ts
test('checkout cannot continue without a postal code', async ({
  inventoryPage,
  cartPage,
  checkoutInfoPage,
}) => {
  await inventoryPage.open();
  await inventoryPage.product(backpack.name).addButton.click();
  await inventoryPage.header.openCart();
  await cartPage.checkout();
  await checkoutInfoPage.expectLoaded();

  await checkoutInfoPage.submit(
    buildCustomer({ firstName: 'Olena', lastName: 'Tester', postalCode: '' }),
  );

  await expect(checkoutInfoPage.error).toHaveText(messages.postalCodeRequired);
  await checkoutInfoPage.expectLoaded();
});
```

The generator also added one line to [`src/data/messages.ts`](src/data/messages.ts): `postalCodeRequired: 'Error: Postal Code is required'`. That is within its scope (it may extend `src/`), and it follows the repository's rule that expected texts live in `src/data/`.

**Did it pass:** yes, 3 of 3. With the postal code filled in by the verifier it failed: the expected error message did not appear. Reviewer: "No findings."

**Fixed by hand:** nothing.

### Example 3 — the case is wrong, and the pipeline says so

**Input:** [`pipeline/cases/sort-price-high-to-low.md`](pipeline/cases/sort-price-high-to-low.md). Steps: log in, choose "Price (high to low)". Expected: *the first product is "Sauce Labs Backpack" with the price $29.99.* That is wrong on purpose: the most expensive product is the Fleece Jacket.

**What the explorer reported** (phase 2, before any code was written):

> - **Case expects:** the first product is "Sauce Labs Backpack" at $29.99.
> - **Observed:** the first product is "Sauce Labs Fleece Jacket" at $49.99. The Backpack is second.
> - **Match:** no.

**Generated:** a test that asserts what the case says, as instructed:

```ts
  await inventoryPage.sortBy('hilo');

  const first = inventoryPage.firstProduct();
  await expect(first.name).toHaveText(backpack.name);
  await expect(first.price).toHaveText(formatUsd(backpack.price));
```

**Did it pass:** no, and that is the correct result. `Expected: "Sauce Labs Backpack" | Received: "Sauce Labs Fleece Jacket"`. Because the explorer had already reported a mismatch, the pipeline did not send the test back for repair. Verdict `CASE_MISMATCH`; the test was not added to the suite, and the `firstProduct()` helper the generator had added to a page object was removed again with the rest of its changes.

**Fixed by hand:** nothing in the pipeline's output. What needs fixing is the case: its title ("puts the most expensive product first") and its expected result disagree, and a person has to decide which one is meant.

## What I had to fix by hand while building it

Not in the generated tests, but in the pipeline around them:

- **A parsing bug in the scope guard.** The first file in `git status` output lost a character of its path, so the guard would have misjudged which file changed. Found by reading the code before the first run.
- **A rejected test broke the type check.** The pipeline kept a rejected attempt in its run folder as a `.ts` file. That attempt called a helper which had just been removed from `src/`, so the next `bun run typecheck` failed on it. CI did not notice, because run folders are not committed; the local check did. Rejected attempts are now saved as `.txt`, and the run folder is excluded from the type checker and from ESLint.
- **My own wrapper script committed too eagerly.** While re-running the examples I used a loop that committed whatever had changed after each run. A folder was renamed in the editor at that moment, and the loop committed the rename under a false message. The pipeline itself had refused to start on a dirty tree; the fault was in the loop, which now commits only after a `VERIFIED` verdict.
