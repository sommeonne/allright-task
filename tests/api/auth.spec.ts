import { expect, test } from '@api/fixtures';
import { tokenSchema } from '@api/schemas/auth';
import { apiCredentials } from '@data/credentials';

test('a wrong password does not return a token', async ({ authClient }) => {
  const result = await authClient.createToken(apiCredentials.username, 'not-the-password');

  expect(result.status).toBe(200); // DESIGN-04: undocumented; a failed login answers 200, 401 fits
  expect(tokenSchema.safeParse(result.json).success).toBe(false);
  expect(result.json).toEqual({ reason: 'Bad credentials' });
});
