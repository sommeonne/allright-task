import type { Locator } from '@playwright/test';

/** One row in the cart. */
export class CartItem {
  readonly name: Locator;
  readonly price: Locator;
  readonly quantity: Locator;
  readonly removeButton: Locator;

  constructor(root: Locator) {
    this.name = root.getByTestId('inventory-item-name');
    this.price = root.getByTestId('inventory-item-price');
    this.quantity = root.getByTestId('item-quantity');
    this.removeButton = root.getByRole('button', { name: 'Remove' });
  }
}
