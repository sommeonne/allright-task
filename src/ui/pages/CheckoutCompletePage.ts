import { expect, type Locator, type Page } from '@playwright/test';
import { Header } from '@ui/pages/components/Header';

export class CheckoutCompletePage {
  readonly header: Header;
  readonly confirmation: Locator;

  constructor(page: Page) {
    this.header = new Header(page);
    this.confirmation = page.getByTestId('complete-header');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.header.title).toHaveText('Checkout: Complete!');
  }
}
