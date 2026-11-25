import { backpack } from '@data/products';
import { expect, test } from '@ui/fixtures';
import { formatUsd } from '@ui/money';

test.describe('cart', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await inventoryPage.open();
  });

  test('an added product appears in the cart and on the cart badge', async ({
    inventoryPage,
    cartPage,
  }) => {
    await inventoryPage.product(backpack.name).addButton.click();
    await expect(inventoryPage.header.cartBadge).toHaveText('1');

    await inventoryPage.header.openCart();

    await expect(cartPage.itemNames).toHaveText([backpack.name]);
    await expect(cartPage.item(backpack.name).price).toHaveText(formatUsd(backpack.price));
    await expect(cartPage.item(backpack.name).quantity).toHaveText('1');
  });

  test('removing the only product empties the cart', async ({ inventoryPage, cartPage }) => {
    await inventoryPage.product(backpack.name).addButton.click();
    await inventoryPage.header.openCart();
    await expect(cartPage.itemNames).toHaveText([backpack.name]);

    await cartPage.item(backpack.name).removeButton.click();

    await expect(cartPage.items).toHaveCount(0);
    await expect(cartPage.header.cartBadge).toBeHidden();
  });

  test('resetting the app state empties the cart', async ({ inventoryPage, cartPage }) => {
    await inventoryPage.product(backpack.name).addButton.click();
    await expect(inventoryPage.header.cartBadge).toHaveText('1');

    await inventoryPage.header.resetAppState();

    await expect(inventoryPage.header.cartBadge).toBeHidden();
    await cartPage.open();
    await expect(cartPage.items).toHaveCount(0);
  });

  // BUG-06: "Reset App State" empties the cart but the product still shows "Remove".
  // The reset itself is covered by the test above, so only the stale button fails here.
  test.fail(
    'resetting the app state returns products to the "Add to cart" state',
    { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-06' } },
    async ({ inventoryPage }) => {
      const product = inventoryPage.product(backpack.name);
      await product.addButton.click();

      await inventoryPage.header.resetAppState();

      await expect(product.addButton).toBeVisible();
    },
  );
});
