import { expect, type Locator, type Page } from '@playwright/test';
import { CartItem } from '@ui/pages/components/CartItem';
import { Header } from '@ui/pages/components/Header';

export class CartPage {
  readonly header: Header;
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly checkoutButton: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.items = page.getByTestId('inventory-item');
    this.itemNames = this.items.getByTestId('inventory-item-name');
    this.checkoutButton = page.getByTestId('checkout');
  }

  async open(): Promise<void> {
    await this.page.goto('/cart.html');
  }

  /** The cart row of the product with this name. */
  item(name: string): CartItem {
    return new CartItem(this.items.filter({ hasText: name }));
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.header.title).toHaveText('Your Cart');
  }
}
