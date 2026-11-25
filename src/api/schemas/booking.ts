import { z } from 'zod';

export const bookingSchema = z.strictObject({
  firstname: z.string(),
  lastname: z.string(),
  totalprice: z.number(),
  depositpaid: z.boolean(),
  bookingdates: z.strictObject({
    checkin: z.iso.date(),
    checkout: z.iso.date(),
  }),
  additionalneeds: z.string().optional(),
});

/** Response of POST /booking. */
export const createdBookingSchema = z.strictObject({
  bookingid: z.number().int().positive(),
  booking: bookingSchema,
});

/** Response of GET /booking. */
export const bookingIdsSchema = z.array(z.strictObject({ bookingid: z.number().int().positive() }));

export type Booking = z.infer<typeof bookingSchema>;
export type CreatedBooking = z.infer<typeof createdBookingSchema>;
