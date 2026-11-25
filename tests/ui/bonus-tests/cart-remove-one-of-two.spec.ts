import { backpack, bikeLight } from '@data/products';
import { expect, test } from '@ui/fixtures';

test('removing one of two products leaves the other in the cart', async ({
  inventoryPage,
  cartPage,
}) => {
  await inventoryPage.open();
  await inventoryPage.product(backpack.name).addButton.click();
  await inventoryPage.product(bikeLight.name).addButton.click();
  await expect(inventoryPage.header.cartBadge).toHaveText('2');

  await inventoryPage.header.openCart();
  await cartPage.expectLoaded();
  await expect(cartPage.itemNames).toHaveText([backpack.name, bikeLight.name]);

  await cartPage.item(backpack.name).removeButton.click();

  await expect(cartPage.itemNames).toHaveText([bikeLight.name]);
  await expect(cartPage.header.cartBadge).toHaveText('1');
});
