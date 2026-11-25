import { expect, type Locator, type Page } from '@playwright/test';
import type { Customer } from '@data/customer';
import { Header } from '@ui/pages/components/Header';

/** Checkout step one: "Your Information". */
export class CheckoutInfoPage {
  readonly header: Header;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continueButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.header = new Header(page);
    this.firstName = page.getByTestId('firstName');
    this.lastName = page.getByTestId('lastName');
    this.postalCode = page.getByTestId('postalCode');
    this.continueButton = page.getByTestId('continue');
    this.error = page.getByTestId('error');
  }

  /** Fills the form and presses Continue. */
  async submit(customer: Customer): Promise<void> {
    await this.firstName.fill(customer.firstName);
    await this.lastName.fill(customer.lastName);
    await this.postalCode.fill(customer.postalCode);
    await this.continueButton.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.header.title).toHaveText('Checkout: Your Information');
  }
}
