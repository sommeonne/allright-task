import type { Locator, Page } from '@playwright/test';

/** The bar shown on every page after login: page title, cart link with badge, burger menu. */
export class Header {
  readonly title: Locator;
  readonly cartLink: Locator;
  /** Present only while the cart is not empty. */
  readonly cartBadge: Locator;
  readonly menuButton: Locator;
  readonly resetAppStateLink: Locator;

  constructor(page: Page) {
    this.title = page.getByTestId('title');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    this.menuButton = page.getByRole('button', { name: 'Open Menu' });
    this.resetAppStateLink = page.getByTestId('reset-sidebar-link');
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  async resetAppState(): Promise<void> {
    await this.menuButton.click();
    await this.resetAppStateLink.click();
  }
}
