# Checkout cannot continue without a postal code

Target: ui

## Steps

1. Log in as standard_user.
2. Add "Sauce Labs Backpack" to the cart.
3. Open the cart and press Checkout.
4. Enter first name "Olena" and last name "Tester". Leave the postal code empty.
5. Press Continue.

## Expected result

The message "Error: Postal Code is required" is shown, and the user stays on the "Checkout: Your Information" step.
