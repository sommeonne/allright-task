import type { Locator } from '@playwright/test';

/** One product in the catalog. Built from the card's own element, so it never sees other cards. */
export class ProductCard {
  readonly name: Locator;
  readonly price: Locator;
  readonly image: Locator;
  // The title and image links also have role="button", so the buttons are found by name.
  readonly addButton: Locator;
  readonly removeButton: Locator;

  constructor(root: Locator) {
    this.name = root.getByTestId('inventory-item-name');
    this.price = root.getByTestId('inventory-item-price');
    this.image = root.getByRole('img');
    this.addButton = root.getByRole('button', { name: 'Add to cart' });
    this.removeButton = root.getByRole('button', { name: 'Remove' });
  }
}
