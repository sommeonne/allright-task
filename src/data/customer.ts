export type Customer = { firstName: string; lastName: string; postalCode: string };

/** A valid customer for the checkout form. Pass overrides for the fields a test is about. */
export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return { firstName: 'Olena', lastName: 'Tester', postalCode: '01001', ...overrides };
}
