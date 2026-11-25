/**
 * saucedemo's catalog is fixed, so it plays the role of seeded test data.
 * Only the products the cart and checkout tests use are pinned here;
 * catalog and sorting tests read whatever the page shows.
 */
export type Product = { name: string; price: number };

export const backpack: Product = { name: 'Sauce Labs Backpack', price: 29.99 };
export const bikeLight: Product = { name: 'Sauce Labs Bike Light', price: 9.99 };
