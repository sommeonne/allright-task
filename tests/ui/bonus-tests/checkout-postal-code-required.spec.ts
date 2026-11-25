import { buildCustomer } from '@data/customer';
import { messages } from '@data/messages';
import { backpack } from '@data/products';
import { expect, test } from '@ui/fixtures';

test('checkout cannot continue without a postal code', async ({
  inventoryPage,
  cartPage,
  checkoutInfoPage,
}) => {
  await inventoryPage.open();
  await inventoryPage.product(backpack.name).addButton.click();
  await inventoryPage.header.openCart();
  await cartPage.checkout();
  await checkoutInfoPage.expectLoaded();

  await checkoutInfoPage.submit(
    buildCustomer({ firstName: 'Olena', lastName: 'Tester', postalCode: '' }),
  );

  await expect(checkoutInfoPage.error).toHaveText(messages.postalCodeRequired);
  await checkoutInfoPage.expectLoaded();
});
