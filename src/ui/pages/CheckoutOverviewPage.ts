import { expect, type Locator, type Page } from '@playwright/test';
import { Header } from '@ui/pages/components/Header';
import { parseUsd } from '@ui/money';

/** Checkout step two: "Overview". */
export class CheckoutOverviewPage {
  readonly header: Header;
  readonly itemNames: Locator;
  /** "Item total: $39.98" */
  readonly itemTotal: Locator;
  /** "Tax: $3.20" */
  readonly tax: Locator;
  /** "Total: $43.18" */
  readonly total: Locator;
  readonly finishButton: Locator;

  constructor(page: Page) {
    this.header = new Header(page);
    this.itemNames = page.getByTestId('inventory-item').getByTestId('inventory-item-name');
    this.itemTotal = page.getByTestId('subtotal-label');
    this.tax = page.getByTestId('tax-label');
    this.total = page.getByTestId('total-label');
    this.finishButton = page.getByTestId('finish');
  }

  /** The tax shown, as a number. */
  async taxAmount(): Promise<number> {
    return parseUsd(await this.tax.innerText());
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.header.title).toHaveText('Checkout: Overview');
  }
}
