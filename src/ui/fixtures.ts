import { test as base } from '@playwright/test';
import { users } from '@data/users';
import { CartPage } from '@ui/pages/CartPage';
import { CheckoutCompletePage } from '@ui/pages/CheckoutCompletePage';
import { CheckoutInfoPage } from '@ui/pages/CheckoutInfoPage';
import { CheckoutOverviewPage } from '@ui/pages/CheckoutOverviewPage';
import { InventoryPage } from '@ui/pages/InventoryPage';
import { LoginPage } from '@ui/pages/LoginPage';

type UiOptions = {
  /** The user a test starts logged in as. `null` starts logged out. */
  user: string | null;
};

type UiFixtures = {
  session: void;
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutInfoPage: CheckoutInfoPage;
  checkoutOverviewPage: CheckoutOverviewPage;
  checkoutCompletePage: CheckoutCompletePage;
};

export const test = base.extend<UiOptions & UiFixtures>({
  user: [users.standard, { option: true }],

  // saucedemo keeps the login in a cookie. Setting it per test skips the login form,
  // which one dedicated test covers. Each test gets its own browser context, so nothing is shared.
  session: [
    async ({ context, baseURL, user }, use) => {
      if (user !== null) {
        await context.addCookies([{ name: 'session-username', value: user, url: baseURL }]);
      }
      await use();
    },
    { auto: true },
  ],

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutInfoPage: async ({ page }, use) => {
    await use(new CheckoutInfoPage(page));
  },
  checkoutOverviewPage: async ({ page }, use) => {
    await use(new CheckoutOverviewPage(page));
  },
  checkoutCompletePage: async ({ page }, use) => {
    await use(new CheckoutCompletePage(page));
  },
});

export { expect } from '@playwright/test';
