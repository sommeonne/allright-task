import { expect, test } from '@ui/fixtures';
import { formatUsd } from '@ui/money';

test.describe('catalog', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await inventoryPage.open();
    await inventoryPage.expectLoaded();
  });

  test('every product shows a name, a price, an image and an add button', async ({
    inventoryPage,
  }) => {
    const productCount = await inventoryPage.items.count();
    const aNonEmptyNamePerProduct = Array<RegExp>(productCount).fill(/\S/);
    const aUsdPricePerProduct = Array<RegExp>(productCount).fill(/^\$\d+\.\d{2}$/);

    await expect(inventoryPage.productNames).toHaveText(aNonEmptyNamePerProduct);
    await expect(inventoryPage.productPrices).toHaveText(aUsdPricePerProduct);
    await expect(inventoryPage.itemsWithImage).toHaveCount(productCount);
    await expect(inventoryPage.itemsWithAddButton).toHaveCount(productCount);
  });

  test('sorting by price, low to high, lists the cheapest product first', async ({
    inventoryPage,
  }) => {
    const initialOrder = await inventoryPage.prices();
    const cheapestFirst = [...initialOrder].sort((a, b) => a - b);
    expect(initialOrder, 'the default order must differ, or sorting proves nothing').not.toEqual(
      cheapestFirst,
    );

    await inventoryPage.sortBy('lohi');

    await expect(inventoryPage.productPrices).toHaveText(cheapestFirst.map(formatUsd));
  });

  test('sorting by name, Z to A, lists products in reverse alphabetical order', async ({
    inventoryPage,
  }) => {
    const initialOrder = await inventoryPage.names();
    const reverseAlphabetical = [...initialOrder].sort().reverse();
    expect(initialOrder, 'the default order must differ, or sorting proves nothing').not.toEqual(
      reverseAlphabetical,
    );

    await inventoryPage.sortBy('za');

    await expect(inventoryPage.productNames).toHaveText(reverseAlphabetical);
  });
});
