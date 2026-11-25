# QA automation test task

[![Tests](https://github.com/sommeonne/allright-task/actions/workflows/tests.yml/badge.svg)](https://github.com/sommeonne/allright-task/actions/workflows/tests.yml)

UI and API tests written with Playwright + TypeScript, in pair with an AI agent (Claude Code).

- **UI:** [saucedemo.com](https://www.saucedemo.com), user `standard_user` — 13 tests, plus 2 written by the bonus pipeline
- **API:** [restful-booker](https://restful-booker.herokuapp.com/apidoc/index.html) — 8 tests
- **Found:** 6 bugs, each with a test and a bug report [below](#found-issues-api)

How the agent was instructed and where it went wrong is in [AI_WORKLOG.md](AI_WORKLOG.md). The bonus task, a pipeline that turns a text test case into a verified Playwright test, is in [BONUS.md](BONUS.md).

## How to run

Requires [Bun](https://bun.com) 1.4 or newer. Bun installs the packages and runs Playwright, ESLint and the TypeScript compiler; Node.js is not needed.

```bash
bun install --frozen-lockfile
bunx --bun playwright install chromium

bun run test          # everything
bun run test:api      # API only
bun run test:ui       # UI only
bun run report        # open the HTML report of the last run
```

Useful selections:

```bash
bun run test --grep-invert @known-bug   # only tests that are expected to pass
bun run test --grep @known-bug          # only the tests for known bugs
bun run test tests/ui/cart.spec.ts --project=ui
bun run lint && bun run typecheck
```

Both applications are public, so no secrets are needed. The targets and the API account can be overridden with `UI_BASE_URL`, `API_BASE_URL`, `API_USERNAME` and `API_PASSWORD`.

### Reading the results

A green run prints `24 passed`: **17 ordinary tests, 6 expected failures** and one setup check that restful-booker is reachable. An expected failure is a test for a known bug: it asserts the correct behaviour, is marked `test.fail()` and tagged `@known-bug`, and carries the bug id in the report. It really runs and really fails; if the bug gets fixed, the test turns red, which is the signal to remove the marker.

## What is covered

### UI — saucedemo (`tests/ui`)

| Area | Test | |
|---|---|---|
| Login | a valid user is taken to the product list (through the real form) | |
| Login | a wrong password shows an error and keeps the user on the login page | negative |
| Login | submitting an empty form asks for the username | negative |
| Catalog | every product shows a name, a price, an image and an add button | |
| Sorting | sorting by price, low to high, lists the cheapest product first | |
| Sorting | sorting by name, Z to A, lists products in reverse alphabetical order | |
| Cart | an added product appears in the cart and on the cart badge | |
| Cart | removing the only product empties the cart | |
| Cart | resetting the app state empties the cart | |
| Cart | resetting the app state returns products to the "Add to cart" state | BUG-06 |
| Checkout | an order for two products can be completed (products, item total, total with tax, confirmation) | |
| Checkout | checkout cannot continue without a first name | negative |
| Checkout | an empty cart cannot be checked out | BUG-05 |

Two more UI tests in `tests/ui/bonus-tests` were written by the [bonus pipeline](BONUS.md) from text cases: removing one of two products from the cart, and checkout without a postal code.

### API — restful-booker (`tests/api`)

| Area | Test | |
|---|---|---|
| Lifecycle | a booking can be created, updated and deleted, and is gone afterwards (authorise → create → update → read back → delete → 404) | |
| Access | updating a booking without a token is rejected and changes nothing | negative |
| Validation | creating a booking without a first name does not create a booking | negative |
| Auth | a wrong password does not return a token | negative |
| Data integrity | a decimal total price is stored unchanged | BUG-01 |
| Data integrity | updating only the check-in date keeps the check-out date | BUG-02 |
| Search | filtering by check-out date returns bookings that check out on or after it | BUG-03 |
| Search | filtering by check-in date includes bookings that check in on that date | BUG-04 |

## What is deliberately not covered

These are end-to-end tests, so they cover the main things a user does: log in, browse and sort the catalog, use the cart, and place an order. For the API it's the booking lifecycle. Each area has its happy path and one or two negative cases.

I didn't add tests for every edge case, such as each validation message, each sort option, each invalid field value or every cart combination. E2E tests are slow and expensive to maintain, and those checks belong in unit and API-level tests next to the code. Covering them through the browser would make the suite bigger without finding more.

Also left out, because the task doesn't ask for them:

- the other saucedemo users (the task names `standard_user`, and every test uses it)
- the product page, menu, logout and footer
- other browsers, visual, performance and security testing

## How the suite is built

```
src/api      clients (one method per endpoint), zod schemas, fixtures with automatic cleanup
src/ui       page objects, components (Header, ProductCard, CartItem), fixtures
src/data     users, pinned products, builders for bookings and customers
tests/api    specs: status → schema → the fields the test is about
tests/ui     specs: read like the test case; no locators, no API calls
```

- **One runner for UI and API.** Playwright's `request` fixture drives the API tests, so there is one config, one HTML report and one CI job.
- **Specs stay at the level of the test case.** Locators live in page objects, HTTP calls in clients. ESLint enforces this (no locators or `request` in specs, no sleeps, no missing `await`).
- **Every test owns its data.** API tests create their own booking and a fixture deletes it afterwards, including bookings a failed test leaves behind. UI tests get a fresh browser context.
- **Logging in.** One test uses the real login form. The others start logged in through the session cookie saucedemo sets, which is faster and keeps a login problem from failing every test.
- **Public, shared services.** restful-booker is used by many people and cold-starts: a setup step waits for `/ping` before the API tests, and only the API project depends on it, so an outage there cannot fail UI tests. Bookings carry a unique last name per run. CI retries a failed test once; a test that passes only on retry is shown as flaky in the report, not hidden.
- **Each test was seen failing.** Before a test was accepted, its action was broken once (wrong user, skipped step) to confirm it fails on the intended assertion.

## CI

[GitHub Actions](.github/workflows/tests.yml) runs on every push and on pull requests to `main`: lint → typecheck → `playwright test --list` (catches broken imports before a browser is downloaded) → tests. The Playwright HTML report is uploaded as the `playwright-report` artifact on every run, including failed ones, and kept for 14 days.

## Found issues (API)

All of these were reproduced twice on 2026-11-25, each with a control request showing that a valid request works.

**How an issue is classified.** The [apidoc](https://restful-booker.herokuapp.com/apidoc/index.html) is the oracle. It documents success responses only.

- **Bug** — the behaviour contradicts something the apidoc states. Each bug has a test that asserts the documented behaviour and is marked `test.fail()` and `@known-bug`: it is expected to fail until the bug is fixed, and turns red when it is.
- **Design issue** — questionable behaviour the apidoc does not cover, or documents that way. Expecting a different status there would be an assumption, so the tests pin the behaviour as observed and do not treat it as a bug.

### Bugs

#### BUG-01: a decimal total price is cut to a whole number

- **Source of the expectation:** apidoc, CreateBooking: `totalprice` — `Number` — "The total price for the booking". No restriction to whole numbers.
- **Test:** `tests/api/booking.spec.ts` — "a decimal total price is stored unchanged"
- **Steps:**
  1. `POST /booking` with a valid body where `"totalprice": 199.99`.
  2. `GET /booking/{id}` for the returned id.
- **Expected:** `totalprice` is `199.99`.
- **Actual:** the create response and the stored booking both have `"totalprice": 199`. The value is cut, not rounded (`0.5` → `0`, `10.01` → `10`, `1234.5` → `1234`). The request is answered `200`, so the client is not told the value changed. `PATCH` behaves the same.
- **Evidence:** test output `Expected: 199.99, Received: 199`.

#### BUG-02: updating only the check-in date destroys the check-out date

- **Source of the expectation:** apidoc, PartialUpdateBooking: "Updates a current booking with a partial payload"; `bookingdates.checkin` and `bookingdates.checkout` are listed as separate optional fields.
- **Test:** `tests/api/booking.spec.ts` — "updating only the check-in date keeps the check-out date"
- **Steps:**
  1. Create a booking with `"bookingdates": {"checkin": "2027-03-01", "checkout": "2027-03-05"}`.
  2. `PATCH /booking/{id}` with a valid token and body `{"bookingdates": {"checkin": "2027-03-02"}}`.
  3. `GET /booking/{id}`.
- **Expected:** check-in is `2027-03-02`, check-out is still `2027-03-05`.
- **Actual:** `PATCH` answers `200`; the stored booking has `"checkout": "0NaN-aN-aN"`. Sending only `checkout` corrupts `checkin` the same way. Sending both dates, or patching another field such as `firstname`, works correctly.
- **Evidence:** test output `- "checkout": "2027-03-05"` / `+ "checkout": "0NaN-aN-aN"`.

#### BUG-03: the check-out date filter works the wrong way round

- **Source of the expectation:** apidoc, GetBookingIds: `checkout` — "Return bookings that have a checkout date greater than or equal to the set checkout date."
- **Test:** `tests/api/booking.spec.ts` — "filtering by check-out date returns bookings that check out on or after it"
- **Steps:**
  1. Create a booking with a unique `lastname`, check-in `2027-08-10`, check-out `2027-08-20`.
  2. `GET /booking?lastname=<lastname>&checkout=2027-08-19`.
  3. `GET /booking?lastname=<lastname>&checkout=2027-08-21`.
- **Expected:** step 2 returns the booking (20 August is after 19 August); step 3 returns `[]`.
- **Actual:** step 2 returns `[]`; step 3 returns the booking. The filter returns bookings that check out on or **before** the given date (`checkout=2030-01-01` returns it, `checkout=2026-01-01` does not).
- **Evidence:** test output: expected `[{ "bookingid": <id> }]`, received `[]`.

#### BUG-04: the check-in date filter leaves out the date itself

- **Source of the expectation:** apidoc, GetBookingIds: `checkin` — "Return bookings that have a checkin date greater than or equal to the set checkin date."
- **Test:** `tests/api/booking.spec.ts` — "filtering by check-in date includes bookings that check in on that date"
- **Steps:**
  1. Create a booking with a unique `lastname`, check-in `2027-08-10`, check-out `2027-08-20`.
  2. `GET /booking?lastname=<lastname>&checkin=2027-08-10`.
- **Expected:** the booking is returned ("greater than **or equal to**").
- **Actual:** `[]`. With `checkin=2027-08-09` the booking is returned, so the filter is "greater than" only.
- **Evidence:** test output: expected `[{ "bookingid": <id> }]`, received `[]`.

### Design issues

Not contradicted by the documentation. The tests assert the actual behaviour and carry the `DESIGN-nn` comment.

| ID | Behaviour | Why it is questionable | Documented? | Where asserted |
|---|---|---|---|---|
| DESIGN-01 | `DELETE /booking/{id}` answers `201 Created` | 201 means a resource was created; 200 or 204 fits a deletion | Yes, documented as 201 | `booking.spec.ts`, lifecycle |
| DESIGN-02 | `PUT`, `PATCH` and `DELETE /booking/{id}` without a token, or with an invalid one, answer `403 Forbidden` (the test covers `PUT` without a token) | Missing credentials are usually `401`; 403 means "authenticated but not allowed" | No | `booking.spec.ts`, negative cases |
| DESIGN-03 | `POST /booking` without the required `firstname` answers `500 Internal Server Error` | The field is documented as required and the booking is correctly not created, but a 500 reports a server failure for what is a client mistake. `PUT` with a required field missing answers `400` | No | `booking.spec.ts`, negative cases |
| DESIGN-04 | `POST /auth` with a wrong password answers `200` with `{"reason":"Bad credentials"}` | No token is issued, so access is not granted, but a client that checks only the status code sees a success | No | `auth.spec.ts` |

## Found issues (UI)

saucedemo has no documentation, so the oracle is an obvious user requirement. Both were found by exploratory testing with `standard_user` and each has a test marked `test.fail()` and `@known-bug`.

#### BUG-05: an order can be placed with an empty cart

- **Source of the expectation:** an order must contain at least one product.
- **Test:** `tests/ui/checkout.spec.ts` — "an empty cart cannot be checked out"
- **Steps:**
  1. Log in as `standard_user`. Do not add anything to the cart.
  2. Open the cart and press **Checkout**.
  3. Fill in first name, last name and postal code, press **Continue**.
  4. Press **Finish**.
- **Expected:** checkout is not available for an empty cart (the test checks that the **Checkout** button is disabled).
- **Actual:** the button is enabled; the overview shows `Item total: $0`, `Total: $0.00`; **Finish** shows "Thank you for your order!".
- **Evidence:** test output `Expected: disabled, Received: enabled`.

#### BUG-06: "Reset App State" leaves the product marked as added

- **Source of the expectation:** after a reset, what the page shows must match the state: an empty cart means no product is marked as being in it.
- **Test:** `tests/ui/cart.spec.ts` — 'resetting the app state returns products to the "Add to cart" state'
- **Steps:**
  1. Log in as `standard_user`.
  2. Press **Add to cart** on Sauce Labs Backpack. The cart badge shows 1 and the button changes to **Remove**.
  3. Open the menu and press **Reset App State**.
- **Expected:** the badge disappears and the Backpack shows **Add to cart** again.
- **Actual:** the badge disappears and the cart is empty, but the Backpack still shows **Remove**. It only changes back after a page reload.
- **Evidence:** test output: `expect(locator).toBeVisible()` for the "Add to cart" button — element not found.
