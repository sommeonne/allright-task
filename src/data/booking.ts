import { randomUUID } from 'node:crypto';
import type { Booking } from '@api/schemas/booking';

/**
 * Marks every booking created by this run, so our data can be told apart
 * from other people's on the shared public server.
 */
export const runMarker = `Autotest-${randomUUID().slice(0, 8)}`;

/** A last name no other booking has, for tests that search by name on the shared server. */
export function uniqueLastName(): string {
  return `${runMarker}-${randomUUID().slice(0, 8)}`;
}

/** A valid booking. Pass overrides for the fields a test is about. */
export function buildBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    firstname: 'Olena',
    lastname: runMarker,
    totalprice: 150,
    depositpaid: true,
    bookingdates: { checkin: '2027-03-01', checkout: '2027-03-05' },
    additionalneeds: 'Breakfast',
    ...overrides,
  };
}
