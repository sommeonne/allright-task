---
name: api-testing
description: Use when writing or editing API tests, API clients, zod schemas or API fixtures for restful-booker (tests/api, src/api).
---

# API tests with Playwright `request` (restful-booker)

Four layers, one job each:

| Layer | Where | Holds |
|---|---|---|
| Schemas | `src/api/schemas/` | zod schema per response shape; TS types inferred from it |
| Clients | `src/api/clients/` | One method per endpoint; returns the raw result |
| Fixtures | `src/api/fixtures.ts` | Clients, auth token, booking factory with cleanup |
| Specs | `tests/api/*.spec.ts` | Status → schema → field assertions |

## Workflow

1. **Check the endpoint.** Find it in the reference table below. If it is not there, read the apidoc (`/apidoc/index.html`) and make one real call; add the result to the table. Never guess a field or a status.
2. **Write the zod schema** and infer the type from it.
3. **Add the client method** following the client contract.
4. **Get test data from a fixture**, never from another test.
5. **Write the spec in this order:** assert the status → parse the body with the schema (success responses only) → assert the specific fields the test is about.
6. **Classify anything odd** with the oracle and bug policy below.
7. **Prove it can fail** (break the action or precondition once, confirm the intended assertion fails, restore), then run: `bun run test tests/api/<file> --project=api`.

## Client contract

```ts
export type ApiResult<T = unknown> = { status: number; text: string; json: T | undefined };
```

- Every client method returns `Promise<ApiResult>`. `json` is the parsed body, or `undefined` when the body is not JSON.
- Clients **never assert and never throw on a non-2xx status**, so negative tests use the same methods.
- One shared helper turns Playwright's `APIResponse` into `ApiResult`: read `text()`, then try `JSON.parse`. Do not call `response.json()`: most error paths answer in plain text and it would throw.
- A client is a class that takes `APIRequestContext` in its constructor. `AuthClient`: `createToken(username, password)`. `BookingClient`: `create`, `get`, `list`, `update` (PUT), `patch`, `delete`.
- Methods that need auth take the token as a parameter (`token?: string`) and send it as `Cookie: token=<token>`. Passing no token must be possible: negative tests need it.

## Schema rules

- One schema per response shape in `src/api/schemas/`, e.g. `bookingSchema`, `createdBookingSchema` (`{ bookingid, booking }`), `tokenSchema`.
- Types come from `z.infer<typeof schema>`. Do not write a second, hand-made interface.
- Parse in the spec, on success paths only: `const booking = bookingSchema.parse(result.json)`. A parse error is a test failure with a readable message.
- Use strict objects (`z.strictObject`) so an unexpected extra field is noticed.

## Fixture rules

- `bookingClient`, `authClient`: built from the `request` fixture.
- `token`: a fresh token from `POST /auth`. Credentials come from env `API_USERNAME` / `API_PASSWORD`, defaulting to the public documented values `admin` / `password123`.
- `createBooking(overrides?)`: creates a valid booking through the client and deletes it in teardown. Use it whenever the test is not about the create call itself.
- `trackCreated(result)`: registers the booking in a `POST /booking` result for deletion in teardown. Use it when the spec calls `bookingClient.create` directly, because the test is about that call (the lifecycle flow, a request expected to be rejected). It does nothing when the result holds no booking id. Teardown accepts 201 (deleted) and 404/405 (the test already deleted it).
- Test data comes from a builder in `src/data/` with valid defaults and a unique marker per run in `lastname`, so data can be told apart on a shared server.

## Oracle and bug policy

The oracle is the apidoc. It documents **success responses only**: no error status and no error body is specified anywhere. An expectation you cannot quote from the apidoc is an assumption. Every odd response falls into one of two classes:

| Case | What to do |
|---|---|
| **BUG** — the behaviour contradicts something the apidoc states: a sentence ("greater than or equal to"), a field type (`Number`), a `required` mark, or "optional" fields of a partial update. | Keep the **correct** assertion. Mark the test `test.fail(title, { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-nn' } }, body)` with a `// BUG-nn: <one line>` comment. Write a README bug report: ID, title, source of the expectation (quote the apidoc), steps, expected, actual, evidence. |
| **DESIGN** — questionable, but the apidoc does not cover it or documents it that way: DELETE answers `201 Created`, no token answers 403, a missing required field answers 500, a wrong password answers 200. Do not assert as "expected" a status the server does not return and the apidoc never promised (400, 401). | Assert what the apidoc does support (a booking without a required field is not created; a wrong password returns no token) and pin the behaviour as observed (the exact status returned). Add `// DESIGN-nn: <one line>`. List it in the README as a design issue. No `test.fail()`. |
| Unsure which one it is | Stop and ask the author. Do not pick the option that makes the test green. |

Never delete or weaken an assertion to make a test pass.

## Example

```ts
test('deleting a booking makes it unavailable', async ({ bookingClient, token, createBooking }) => {
  const created = await createBooking();

  const deleted = await bookingClient.delete(created.bookingid, token);
  expect(deleted.status).toBe(201); // DESIGN-01: apidoc documents 201 Created for DELETE

  const fetched = await bookingClient.get(created.bookingid);
  expect(fetched.status).toBe(404); // observed, undocumented: a missing booking answers 404
});
```

## restful-booker reference

Verified on 2026-11-25 with live calls. "Doc" = the apidoc documents this response.

| Request | Status | Body | Doc | Class |
|---|---|---|---|---|
| `GET /ping` | 201 | text `Created` | yes | OK (documented) |
| `POST /auth`, valid credentials | 200 | JSON `{ token }` | yes | OK |
| `POST /auth`, wrong password | 200 | JSON `{ reason: "Bad credentials" }`, no token | no | DESIGN-04 |
| `POST /booking`, valid | 200 | JSON `{ bookingid, booking }` | yes | OK (201 would be more precise; documented as 200) |
| `POST /booking`, required field missing | 500 | text `Internal Server Error`; no booking is created | no | DESIGN-03 |
| `POST /booking`, `totalprice: 199.99` | 200 | stored as `199` (cut, not rounded; PATCH does the same) | type `Number` | **BUG-01** |
| `PUT /booking/{id}`, valid token, required field missing | 400 | text `Bad Request`; booking unchanged | no | OK (compare DESIGN-03) |
| `GET /booking/{id}`, exists | 200 | JSON booking (no `bookingid` inside) | yes | OK |
| `GET /booking/{id}`, does not exist | 404 | text `Not Found` | no | OK |
| `GET /booking?lastname=<x>` | 200 | JSON array of `{ bookingid }`, `[]` when none; case-sensitive; combines with the date filters | yes | OK |
| `GET /booking?checkin=<date>` | 200 | returns bookings with check-in **after** the date; the date itself is excluded | says "greater than or equal to" | **BUG-04** |
| `GET /booking?checkout=<date>` | 200 | returns bookings with check-out **on or before** the date | says "greater than or equal to" | **BUG-03** |
| `PATCH /booking/{id}` with only `bookingdates.checkin` (or only `checkout`) | 200 | the other date becomes `"0NaN-aN-aN"` | both fields optional | **BUG-02** |
| `PUT` / `PATCH /booking/{id}`, valid token | 200 | JSON booking | yes | OK |
| `PUT` / `PATCH` / `DELETE`, no token | 403 | text `Forbidden` | no | DESIGN-02 |
| `PUT` / `PATCH` / `DELETE`, bogus token | 403 | text `Forbidden` | no | DESIGN-02 |
| `DELETE /booking/{id}`, valid token | 201 | text `Created` | yes | DESIGN-01 |
| `GET /booking/{id}` after DELETE | 404 | text `Not Found` | no | OK — observed behaviour, **used as the check that the booking is gone**; assert it with an `// observed, undocumented` comment |
| `DELETE` / `PUT` / `PATCH` on an id that does not exist | 405 | text `Method Not Allowed` | no | OK — the code relies on it |
| `GET /booking/{id}` with no `Accept` header | 418 | text `I'm a Teapot` | no | OK — the code relies on it (other endpoints answer normally without the header) |

Numbering: take the next free number in the README's list (`DESIGN-05`, `BUG-07`, …) and add the entry there in the same change. A new BUG needs the apidoc quote it contradicts; without one it is a DESIGN issue.

**Facts to rely on:**
- Token goes in the `Cookie: token=<token>` header. The apidoc also allows `Authorization: Basic ...`; the tests use the cookie.
- `Accept: application/json` is set for the whole `api` project in `playwright.config.ts` (`extraHTTPHeaders`). Sending JSON needs `Content-Type: application/json`; Playwright adds it when you pass `data` as an object.
- Booking body: `firstname`, `lastname` (strings), `totalprice` (number), `depositpaid` (boolean), `bookingdates: { checkin, checkout }` (`YYYY-MM-DD` strings), `additionalneeds` (string, optional).
- The server is shared and public: it resets periodically and other people's bookings exist. Never assert on the total number of bookings or on a fixed id.
- It cold-starts. The `api-setup` project waits for `/ping` before any API test runs.

## Anti-patterns

| Do not | Do instead |
|---|---|
| `response.json()` on a response that may be plain text | The shared `ApiResult` helper |
| `expect(body).toEqual(wholeObject)` when the test is about two fields | Schema parse + assertions on those fields |
| A booking id shared between tests or stored at module level | `createBooking` fixture per test |
| A test that leaves its booking behind | Fixture teardown deletes it |
| `expect(status).toBeTruthy()` / `toBeLessThan(500)` | The exact status, documented or observed |
| Expecting a status the server does not return (400, 401) because "that is what HTTP says", and calling the difference a bug | Quote the apidoc, or classify it as DESIGN and pin the observed status |
| A negative test that sends valid data | Change exactly one thing that makes the request invalid |
| A quirk asserted with no `DESIGN-nn` / `BUG-nn` comment | Classify it with the policy above |
| Asserting inside a client, or throwing on 4xx/5xx | Return `ApiResult`; assert in the spec |
