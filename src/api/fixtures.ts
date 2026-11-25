import { test as base } from '@playwright/test';
import { AuthClient } from '@api/clients/AuthClient';
import { BookingClient } from '@api/clients/BookingClient';
import type { ApiResult } from '@api/http';
import { z } from 'zod';
import { tokenSchema } from '@api/schemas/auth';
import { type Booking, type CreatedBooking, createdBookingSchema } from '@api/schemas/booking';
import { buildBooking } from '@data/booking';
import { apiCredentials } from '@data/credentials';

type ApiFixtures = {
  authClient: AuthClient;
  bookingClient: BookingClient;
  /** A fresh auth token for the default account. */
  token: string;
  /**
   * Registers the booking in a `POST /booking` result for deletion after the test.
   * Does nothing when the result holds no booking, so it is safe to call on a
   * request that is expected to be rejected.
   */
  trackCreated: (result: ApiResult) => void;
  /** Creates a valid booking and deletes it after the test. */
  createBooking: (overrides?: Partial<Booking>) => Promise<CreatedBooking>;
};

/** Setup helpers fail with the server's answer, not with a schema error, when the service misbehaves. */
function answered(action: string, result: ApiResult): string {
  return `${action} answered ${result.status} ${result.text}`;
}

async function fetchToken(authClient: AuthClient): Promise<string> {
  const result = await authClient.createToken(apiCredentials.username, apiCredentials.password);
  const parsed = tokenSchema.safeParse(result.json);
  if (!parsed.success) throw new Error(answered('Setup: POST /auth', result));
  return parsed.data.token;
}

export const test = base.extend<ApiFixtures>({
  authClient: async ({ request }, use) => {
    await use(new AuthClient(request));
  },

  bookingClient: async ({ request }, use) => {
    await use(new BookingClient(request));
  },

  token: async ({ authClient }, use) => {
    await use(await fetchToken(authClient));
  },

  trackCreated: async ({ authClient, bookingClient }, use) => {
    const ids: number[] = [];
    await use((result) => {
      // Loose on purpose: a booking the server stored in a broken shape must still be deleted.
      const created = z.looseObject({ bookingid: z.number() }).safeParse(result.json);
      if (created.success) ids.push(created.data.bookingid);
    });

    if (ids.length === 0) return;
    const token = await fetchToken(authClient);
    const failures: string[] = [];
    for (const id of ids) {
      const deleted = await bookingClient.delete(id, token);
      // 201 = deleted now; 404/405 = the test already deleted it.
      if (![201, 404, 405].includes(deleted.status)) {
        failures.push(answered(`DELETE /booking/${id}`, deleted));
      }
    }
    // Try every booking before failing, so one bad delete does not leave the rest behind.
    if (failures.length > 0) throw new Error(`Cleanup failed: ${failures.join('; ')}`);
  },

  createBooking: async ({ bookingClient, trackCreated }, use) => {
    await use(async (overrides = {}) => {
      const result = await bookingClient.create(buildBooking(overrides));
      trackCreated(result);
      const parsed = createdBookingSchema.safeParse(result.json);
      if (!parsed.success) throw new Error(answered('Setup: POST /booking', result));
      return parsed.data;
    });
  },
});

export { expect } from '@playwright/test';
