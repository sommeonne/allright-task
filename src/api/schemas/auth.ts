import { z } from 'zod';

/** Response of POST /auth with valid credentials. */
export const tokenSchema = z.strictObject({
  token: z.string().min(1),
});

export type Token = z.infer<typeof tokenSchema>;
