import { expect, test as setup } from '@playwright/test';

setup('restful-booker is reachable', async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get('/ping')).status();
        } catch {
          return 0; // network error: keep polling until the timeout
        }
      },
      {
        message:
          'restful-booker did not answer GET /ping with 201 — the service is down or cold-starting',
        intervals: [3_000],
        timeout: 30_000,
      },
    )
    .toBe(201);
});
