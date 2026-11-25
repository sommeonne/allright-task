/**
 * restful-booker's public, documented default account.
 * Override with API_USERNAME / API_PASSWORD when pointing the tests at another instance.
 */
export const apiCredentials = {
  username: process.env.API_USERNAME ?? 'admin',
  password: process.env.API_PASSWORD ?? 'password123',
};
