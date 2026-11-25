import { messages } from '@data/messages';
import { password, users } from '@data/users';
import { expect, test } from '@ui/fixtures';

// These tests are about the login form, so they start logged out.
test.use({ user: null });

test.describe('login', () => {
  test('a valid user is taken to the product list', async ({ loginPage, inventoryPage }) => {
    await loginPage.open();
    await loginPage.login(users.standard, password);

    await inventoryPage.expectLoaded();
  });

  test('a wrong password shows an error and keeps the user on the login page', async ({
    loginPage,
  }) => {
    await loginPage.open();
    await loginPage.login(users.standard, 'not-the-password');

    await expect(loginPage.error).toHaveText(messages.wrongCredentials);
    await loginPage.expectLoaded();
  });

  test('submitting an empty form asks for the username', async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.login('', '');

    await expect(loginPage.error).toHaveText(messages.usernameRequired);
    await loginPage.expectLoaded();
  });
});
