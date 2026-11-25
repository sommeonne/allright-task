import { buildCustomer } from '@data/customer';
import { messages } from '@data/messages';
import { backpack, bikeLight } from '@data/products';
import { expect, test } from '@ui/fixtures';
import { formatUsd, sumUsd } from '@ui/money';

test.describe('checkout', () => {
  test('an order for two products can be completed', async ({
    inventoryPage,
    cartPage,
    checkoutInfoPage,
    checkoutOverviewPage,
    checkoutCompletePage,
  }) => {
    const itemTotal = sumUsd([backpack.price, bikeLight.price]);

    await test.step('add two products and open the cart', async () => {
      await inventoryPage.open();
      await inventoryPage.product(backpack.name).addButton.click();
      await inventoryPage.product(bikeLight.name).addButton.click();
      await inventoryPage.header.openCart();
      await expect(cartPage.itemNames).toHaveText([backpack.name, bikeLight.name]);
    });

    await test.step('enter customer information', async () => {
      await cartPage.checkout();
      await checkoutInfoPage.submit(buildCustomer());
    });

    await test.step('the overview lists both products; total is item total plus the tax shown', async () => {
      await checkoutOverviewPage.expectLoaded();
      await expect(checkoutOverviewPage.itemNames).toHaveText([backpack.name, bikeLight.name]);
      await expect(checkoutOverviewPage.itemTotal).toHaveText(`Item total: ${formatUsd(itemTotal)}`);

      const tax = await checkoutOverviewPage.taxAmount();
      await expect(checkoutOverviewPage.total).toHaveText(
        `Total: ${formatUsd(sumUsd([itemTotal, tax]))}`,
      );
    });

    await test.step('finish the order', async () => {
      await checkoutOverviewPage.finish();
      await checkoutCompletePage.expectLoaded();
      await expect(checkoutCompletePage.confirmation).toHaveText(messages.orderComplete);
      await expect(checkoutCompletePage.header.cartBadge).toBeHidden();
    });
  });

  test('checkout cannot continue without a first name', async ({
    inventoryPage,
    cartPage,
    checkoutInfoPage,
  }) => {
    await inventoryPage.open();
    await inventoryPage.product(backpack.name).addButton.click();
    await inventoryPage.header.openCart();
    await cartPage.checkout();

    await checkoutInfoPage.submit(buildCustomer({ firstName: '' }));

    await expect(checkoutInfoPage.error).toHaveText(messages.firstNameRequired);
    await checkoutInfoPage.expectLoaded();
  });

  // BUG-05: the Checkout button is active for an empty cart and an order with no items can be placed.
  // The assertion pins one way of preventing it (a disabled button); see the README entry.
  test.fail(
    'an empty cart cannot be checked out',
    { tag: '@known-bug', annotation: { type: 'issue', description: 'BUG-05' } },
    async ({ cartPage }) => {
      await cartPage.open();
      await cartPage.expectLoaded();
      await expect(cartPage.items).toHaveCount(0);

      await expect(cartPage.checkoutButton).toBeDisabled();
    },
  );
});
