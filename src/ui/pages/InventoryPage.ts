import { expect, type Locator, type Page } from '@playwright/test';
import { Header } from '@ui/pages/components/Header';
import { ProductCard } from '@ui/pages/components/ProductCard';
import { parseUsd } from '@ui/money';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage {
  readonly header: Header;
  readonly items: Locator;
  readonly productNames: Locator;
  readonly productPrices: Locator;
  /** Cards that contain an image / an "Add to cart" button: for checking every card has one. */
  readonly itemsWithImage: Locator;
  readonly itemsWithAddButton: Locator;
  readonly sortSelect: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.items = page.getByTestId('inventory-item');
    this.productNames = this.items.getByTestId('inventory-item-name');
    this.productPrices = this.items.getByTestId('inventory-item-price');
    this.itemsWithImage = this.items.filter({ has: page.getByRole('img') });
    this.itemsWithAddButton = this.items.filter({
      has: page.getByRole('button', { name: 'Add to cart' }),
    });
    this.sortSelect = page.getByTestId('product-sort-container');
  }

  async open(): Promise<void> {
    await this.page.goto('/inventory.html');
  }

  /** The card of the product with this name. */
  product(name: string): ProductCard {
    return new ProductCard(this.items.filter({ hasText: name }));
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sortSelect.selectOption(option);
  }

  /** Product names in the order shown. */
  async names(): Promise<string[]> {
    return this.productNames.allTextContents();
  }

  /** Product prices in the order shown, as numbers. */
  async prices(): Promise<number[]> {
    return (await this.productPrices.allTextContents()).map(parseUsd);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.header.title).toHaveText('Products');
    await expect(this.items).not.toHaveCount(0);
  }
}
