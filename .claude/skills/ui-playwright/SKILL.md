---
name: ui-playwright
description: Use when writing or editing Playwright UI tests, page objects or UI fixtures for saucedemo (tests/ui, src/ui).
---

# UI tests with Playwright (saucedemo)

Three layers, one job each:

| Layer | Where | Holds |
|---|---|---|
| Page objects and components | `src/ui/pages/` | Locators and user actions |
| Fixtures | `src/ui/fixtures.ts` | Hand page objects and login state to tests |
| Specs | `tests/ui/*.spec.ts` | The test case: actions and assertions |

## Workflow

1. **Find the element.** Look it up in the reference table below. If it is not there, open the page in the Playwright MCP browser, bring it to the state you need (click, submit), read the real `data-test` id, and add it to the table. Never guess an id.
2. **Add or extend the page object** (or component) following the rules below.
3. **Expose it through a fixture** in `src/ui/fixtures.ts`.
4. **Write the spec** following the spec rules.
5. **Prove it can fail.** Break the action or precondition once (skip the step, use another item), confirm the test fails on the intended assertion, restore. Changing the expected value does not count.
6. **Run it:** `bun run test tests/ui/<file> --project=ui`.

## Patterns

- **Page object** — one class per page.
- **Shared component** — a part shown on several pages (header with cart link and badge, burger menu). A class in `src/ui/pages/components/` whose constructor takes `Page`. Each page that shows it holds it as a `readonly` field. No `BasePage` and no inheritance: the login page has no header.
- **Repeated component** — a part that repeats in a list (product card, cart row). A class in `src/ui/pages/components/` whose constructor takes a root `Locator` and builds its locators only inside that root. The page hands one out by a business key: `product(name: string): ProductCard`. This replaces `nth()` and ids built from product names.
- **When to extract a component** — only when the part appears on two or more pages or repeats in a list. A part used once stays in its page object.
- **Fixtures do the wiring** — specs never call `new`.

## Page object rules

- File `src/ui/pages/<Name>Page.ts`, constructor takes `Page`.
- Locators are `readonly` fields built with `getByTestId` (configured to `data-test`) or `getByRole`/`getByLabel`. No CSS or XPath.
- Methods are user actions (`login`, `sortBy`, `openCart`) or read values (`prices(): Promise<number[]>`). They do not assert.
- The single allowed assertion method is `expectLoaded()`, which checks the page's own marker. Lint counts it as an assertion, so a spec may end with it.
- Lint applies here too: no `waitForTimeout`, no `.locator('css')`.
- `open()` navigates with `page.goto(path)`. Never assert the response status of `goto`: deep links answer HTTP 404 with the app shell.

## Spec rules

- Import `test` and `expect` from `@ui/fixtures`, not from `@playwright/test`.
- The title states the expected behaviour: `adding an item shows it in the cart`.
- Assert with web-first matchers on locators the page object exposes: `await expect(inventoryPage.header.cartBadge).toHaveText('1')`. Building a new locator in a spec is a lint error.
- No shared state between tests. Each test sets up what it needs.
- Use `test.step` only when a flow has distinct stages (e.g. checkout).
- Login state: tests start logged in as `standard_user`. An automatic fixture sets the session cookie (see reference), so specs do not ask for it. A spec that needs the login page opts out with `test.use({ user: null })`; another user is `test.use({ user: 'problem_user' })`. Exactly one test in the suite logs in through the real form.
- Expected values come from a source: test data in `src/data/`, or values read from the page earlier in the same test (e.g. total = item total + the tax shown). No magic numbers.
- **Catalog data.** Do not assert the catalog's contents (every product's name and price): that tests the shop's data, not its behaviour. Catalog tests check structure (every card has a name, a price in `$0.00` format, an image, an add button) and sorting tests compare the page with the same list sorted in code. The fixed demo catalog is treated as seeded data: only the products that cart and checkout tests need are pinned in `src/data/products.ts`.
- A known bug is a `test.fail(title, { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-nn' } }, body)` with a `// BUG-nn:` comment and a README report. There is no documentation for saucedemo, so a UI bug is a judgement about an obvious user requirement: the author decides what counts before a test is written.

## Example

```ts
// src/ui/pages/components/ProductCard.ts
export class ProductCard {
  readonly name: Locator;
  readonly price: Locator;
  readonly addButton: Locator;

  constructor(root: Locator) {
    this.name = root.getByTestId('inventory-item-name');
    this.price = root.getByTestId('inventory-item-price');
    this.addButton = root.getByRole('button', { name: 'Add to cart' });
  }
}

// src/ui/pages/InventoryPage.ts (excerpt)
product(name: string): ProductCard {
  return new ProductCard(this.items.filter({ hasText: name }));
}

// tests/ui/cart.spec.ts
test('adding an item shows it in the cart', async ({ inventoryPage, cartPage }) => {
  await inventoryPage.open();
  await inventoryPage.product('Sauce Labs Backpack').addButton.click();
  await expect(inventoryPage.header.cartBadge).toHaveText('1');

  await inventoryPage.header.openCart();
  await expect(cartPage.itemNames).toHaveText(['Sauce Labs Backpack']);
});
```

## saucedemo reference

Verified on 2026-11-25 through the Playwright MCP browser. `x6` = appears six times.

**Test-id attribute.** saucedemo uses `data-test`. It is configured in two places that must match: `use.testIdAttribute` in `playwright.config.ts` and `--test-id-attribute` in `.mcp.json`. For an app that uses another attribute (e.g. `data-qa`), change both.

**Header and menu (every page after login):** `shopping-cart-link`, `shopping-cart-badge` (present only when the cart is not empty), `title` (page title text), `open-menu`, `close-menu`, `inventory-sidebar-link`, `about-sidebar-link`, `logout-sidebar-link`, `reset-sidebar-link`. The menu opens with `getByRole('button', { name: 'Open Menu' })` (`open-menu` is the image inside that button).

**Page titles (`title`):** `Products`, `Your Cart`, `Checkout: Your Information`, `Checkout: Overview`, `Checkout: Complete!`.

| Page / state | Path | `data-test` ids |
|---|---|---|
| Login | `/` | `username`, `password`, `login-button` |
| Login, error shown | `/` | adds `error` (message), `error-button` (dismiss) |
| Inventory | `/inventory.html` | `inventory-list`, `inventory-item` x6, inside each: `inventory-item-name`, `inventory-item-desc`, `inventory-item-price`; `product-sort-container` (select), `active-option`; per product: `add-to-cart-<product-slug>`, `item-<id>-title-link`, `item-<id>-img-link` |
| Inventory, item added | `/inventory.html` | that product's `add-to-cart-<slug>` is replaced by `remove-<slug>`; `shopping-cart-badge` appears |
| Product details | `/inventory-item.html?id=4` | `inventory-item-name`, `inventory-item-desc`, `inventory-item-price`, `add-to-cart`, or `remove` when the item is in the cart (no slug here), `back-to-products` |
| Cart | `/cart.html` | `cart-list`, `inventory-item` per row, inside each: `inventory-item-name`, `inventory-item-desc`, `inventory-item-price`, `item-quantity`, `remove-<slug>`; `continue-shopping`, `checkout` |
| Checkout: your information | `/checkout-step-one.html` | `firstName`, `lastName`, `postalCode`, `continue`, `cancel` |
| Checkout: information, submitted empty | `/checkout-step-one.html` | adds `error`, `error-button` |
| Checkout: overview | `/checkout-step-two.html` | `cart-list`, `inventory-item` rows as in the cart, `payment-info-value`, `shipping-info-value`, `subtotal-label`, `tax-label`, `total-label`, `finish`, `cancel` |
| Checkout: complete | `/checkout-complete.html` | `complete-header`, `complete-text`, `back-to-products`; `shopping-cart-badge` is gone |

`<product-slug>` is the product name in kebab case, e.g. `sauce-labs-backpack`. Prefer the `ProductCard` component over slug-built ids.

**Role gotcha.** Inside a product card the title link and image link also have `role="button"`. `getByRole('button')` alone matches three elements: always pass the name (`{ name: 'Add to cart' }`).

**Sort options** (`product-sort-container` values): `az` Name (A to Z), `za` Name (Z to A), `lohi` Price (low to high), `hilo` Price (high to low).

**Exact messages:**
- Locked-out user: `Epic sadface: Sorry, this user has been locked out.`
- Empty login form: `Epic sadface: Username is required`
- Empty password: `Epic sadface: Password is required`
- Wrong password or unknown user: `Epic sadface: Username and password do not match any user in this service`
- Page opened without login: `Epic sadface: You can only access '/inventory.html' when you are logged in.` (the path changes with the page)
- Checkout form: `Error: First Name is required`, `Error: Last Name is required`, `Error: Postal Code is required` (the first missing field wins)
- Order placed: `Thank you for your order!` (`complete-header`)

**Feedback to the user.** saucedemo has no snackbars or toasts (checked with a DOM mutation observer while adding, removing and sorting). Adding a product is confirmed only by the cart badge and the button changing to "Remove". Errors are inline banners (`error`, an `h3` with `role="alert"`) that stay until dismissed with `error-button`; they do not hide on their own.

**Products and totals.** Six products; each card has one image (`getByRole('img')`). Pinned in `src/data/products.ts`: Sauce Labs Backpack `$29.99`, Sauce Labs Bike Light `$9.99`. Overview labels: `Item total: $39.98`, `Tax: $3.20`, `Total: $43.18` for those two (tax is 8%, read it from the page). Default sort is `Name (A to Z)`.

**Known bugs (accepted by the author, see README):**
- BUG-05: the Checkout button is enabled for an empty cart and an order with no items completes.
- BUG-06: "Reset App State" empties the cart and hides the badge, but the product still shows "Remove" until the page is reloaded.

**Login state.**
- Password for every user: `secret_sauce`.
- A successful login sets the cookie `session-username=<username>`; it expires after 10 minutes. The automatic `session` fixture in `src/ui/fixtures.ts` sets it per test with `context.addCookies({ name, value, url: baseURL })` for the user given by the `user` option (default `standard_user`, `null` = logged out). Do not save it to a shared storage-state file.

**Cart state.** Kept in `localStorage` under `cart-contents` as a JSON array of product ids (`[4]` after adding the Backpack). Finishing checkout removes the key.

**Users.**

| User | Behaviour |
|---|---|
| `standard_user` | Normal. **The only user the tests log in as**: the task names this account. |
| `locked_out_user` | Cannot log in; message above. Verified, but not used in tests. |
| `problem_user`, `performance_glitch_user`, `error_user`, `visual_user` | **Not verified.** Check the actual behaviour in the MCP browser before writing a test for them. |

## Anti-patterns

| Do not | Do instead |
|---|---|
| `page.waitForTimeout(...)` or any sleep | Web-first assertion on the element you are waiting for |
| `nth(2)` to pick a product or row | Repeated component filtered by name |
| Locator or `page.goto` status assertion in a spec | Page object method / `expectLoaded()` |
| Hard-coded price or total with no source | Test data in `src/data/` or values read from the page |
| A test that needs another test to run first | Set up state in the test or a fixture |
| `test.only`, `test.skip` left in | Remove before finishing (`forbidOnly` fails CI) |
| An id that is not in the table above | Verify it in the MCP browser and add it |
| Weakening an assertion because the app misbehaves | Follow the bug policy in CLAUDE.md |
