import { expect, test } from '@api/fixtures';
import { tokenSchema } from '@api/schemas/auth';
import {
  type Booking,
  bookingIdsSchema,
  bookingSchema,
  createdBookingSchema,
} from '@api/schemas/booking';
import { buildBooking, uniqueLastName } from '@data/booking';
import { apiCredentials } from '@data/credentials';

test.describe('lifecycle', () => {
  test('a booking can be created, updated and deleted, and is gone afterwards', async ({
    authClient,
    bookingClient,
    trackCreated,
  }) => {
    const original = buildBooking();
    const changed = buildBooking({ firstname: 'Taras', totalprice: 275, depositpaid: false });

    const token = await test.step('authorise', async () => {
      const result = await authClient.createToken(apiCredentials.username, apiCredentials.password);
      expect(result.status).toBe(200);
      return tokenSchema.parse(result.json).token;
    });

    const bookingId = await test.step('create a booking', async () => {
      const result = await bookingClient.create(original);
      trackCreated(result);
      expect(result.status).toBe(200);
      const created = createdBookingSchema.parse(result.json);
      expect(created.booking).toEqual(original);
      return created.bookingid;
    });

    await test.step('update the booking', async () => {
      const result = await bookingClient.update(bookingId, changed, token);
      expect(result.status).toBe(200);
      expect(bookingSchema.parse(result.json)).toEqual(changed);
    });

    await test.step('the update is stored', async () => {
      const result = await bookingClient.get(bookingId);
      expect(result.status).toBe(200);
      expect(bookingSchema.parse(result.json)).toEqual(changed);
    });

    await test.step('delete the booking', async () => {
      const result = await bookingClient.delete(bookingId, token);
      expect(result.status).toBe(201); // DESIGN-01: apidoc documents 201 Created for DELETE
    });

    await test.step('the booking no longer exists', async () => {
      const result = await bookingClient.get(bookingId);
      expect(result.status).toBe(404); // observed, undocumented: a missing booking answers 404
    });
  });
});

test.describe('negative cases', () => {
  test('updating a booking without a token is rejected and changes nothing', async ({
    bookingClient,
    createBooking,
  }) => {
    const created = await createBooking();

    const result = await bookingClient.update(
      created.bookingid,
      buildBooking({ firstname: 'Intruder' }),
      // no token
    );
    expect(result.status).toBe(403); // DESIGN-02: undocumented; 401 fits missing credentials

    const stored = await bookingClient.get(created.bookingid);
    expect(stored.status).toBe(200);
    expect(bookingSchema.parse(stored.json).firstname).toBe(created.booking.firstname);
  });

  // The apidoc marks `firstname` as required for POST /booking.
  test('creating a booking without a first name does not create a booking', async ({
    bookingClient,
    trackCreated,
  }) => {
    const lastname = uniqueLastName();
    const withoutFirstName: Partial<Booking> = buildBooking({ lastname });
    delete withoutFirstName.firstname;

    const result = await bookingClient.create(withoutFirstName);
    trackCreated(result); // deletes the booking if the server ever accepts the request

    expect(result.status).toBe(500); // DESIGN-03: undocumented; a client mistake answered as a server error
    expect(result.json).toBeUndefined(); // plain-text body, so no booking id is returned

    const found = await bookingClient.list({ lastname });
    expect(found.status).toBe(200);
    expect(bookingIdsSchema.parse(found.json)).toEqual([]);
  });
});

test.describe('data integrity', () => {
  // BUG-01: a decimal total price is cut to a whole number (199.99 is stored as 199).
  test.fail(
    'a decimal total price is stored unchanged',
    { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-01' } },
    async ({ bookingClient, createBooking }) => {
      const price = 199.99;
      const created = await createBooking({ totalprice: price });

      const stored = await bookingClient.get(created.bookingid);
      expect(stored.status).toBe(200);
      expect(bookingSchema.parse(stored.json).totalprice).toBe(price);
    },
  );

  // BUG-02: PATCH with only bookingdates.checkin replaces the check-out date with "0NaN-aN-aN".
  test.fail(
    'updating only the check-in date keeps the check-out date',
    { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-02' } },
    async ({ bookingClient, createBooking, token }) => {
      const original = { checkin: '2027-03-01', checkout: '2027-03-05' };
      const newCheckin = '2027-03-02';
      const created = await createBooking({ bookingdates: original });

      const patched = await bookingClient.patch(
        created.bookingid,
        { bookingdates: { checkin: newCheckin } },
        token,
      );
      expect(patched.status).toBe(200);

      const stored = await bookingClient.get(created.bookingid);
      expect(stored.status).toBe(200);
      // Compared without the schema: the corrupted date would fail parsing before this assertion.
      expect(stored.json).toMatchObject({
        bookingdates: { checkin: newCheckin, checkout: original.checkout },
      });
    },
  );
});

test.describe('search by dates', () => {
  const stay = { checkin: '2027-08-10', checkout: '2027-08-20' };
  const dayBeforeCheckout = '2027-08-19';
  const dayAfterCheckout = '2027-08-21';

  // apidoc: "Return bookings that have a checkout date greater than or equal to the set checkout date."
  // BUG-03: the filter works the other way round and returns bookings that check out on or before it.
  test.fail(
    'filtering by check-out date returns bookings that check out on or after it',
    { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-03' } },
    async ({ bookingClient, createBooking }) => {
      const lastname = uniqueLastName();
      const created = await createBooking({ lastname, bookingdates: stay });

      const fromEarlierDate = await bookingClient.list({ lastname, checkout: dayBeforeCheckout });
      expect(fromEarlierDate.status).toBe(200);
      // Soft, so both halves of the documented rule are checked and reported.
      expect.soft(bookingIdsSchema.parse(fromEarlierDate.json)).toEqual([
        { bookingid: created.bookingid },
      ]);

      const fromLaterDate = await bookingClient.list({ lastname, checkout: dayAfterCheckout });
      expect(fromLaterDate.status).toBe(200);
      expect.soft(bookingIdsSchema.parse(fromLaterDate.json)).toEqual([]);
    },
  );

  // apidoc: "Return bookings that have a checkin date greater than or equal to the set checkin date."
  // BUG-04: a booking that checks in exactly on the given date is left out.
  test.fail(
    'filtering by check-in date includes bookings that check in on that date',
    { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-04' } },
    async ({ bookingClient, createBooking }) => {
      const lastname = uniqueLastName();
      const created = await createBooking({ lastname, bookingdates: stay });

      const result = await bookingClient.list({ lastname, checkin: stay.checkin });
      expect(result.status).toBe(200);
      expect(bookingIdsSchema.parse(result.json)).toEqual([{ bookingid: created.bookingid }]);
    },
  );
});
