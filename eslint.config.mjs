import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', 'pipeline/runs/'] },

  // All TypeScript: type-aware linting.
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // The real "missing await" catcher for Playwright calls.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // Tests and the code behind them (page objects, clients, fixtures): Playwright pitfalls.
  {
    files: ['tests/**/*.ts', 'src/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'error', // a known bug is test.fail(), never skip
      'playwright/no-force-option': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-raw-locators': 'error', // no CSS/XPath: use getByTestId / getByRole
      'playwright/no-conditional-in-test': 'error',
      // A page object's expectLoaded() is an assertion.
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectLoaded'] }],
    },
  },

  // Specs only: the layering rule. Setup files may talk to the API directly.
  // These selectors catch the usual forms, including aliases; they cannot catch
  // everything, so the test-reviewer agent also checks layering.
  {
    files: ['tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          // page.getByTestId(...), p.locator(...), anything.getByRole(...)
          'CallExpression[callee.property.name=/^(locator|getBy\\w+|\\$\\$?)$/]',
          // page['getByTestId'](...)
          'CallExpression[callee.computed=true][callee.property.value=/^(locator|getBy\\w+|\\$\\$?)$/]',
          // const { getByRole } = page
          'VariableDeclarator > ObjectPattern > Property[key.name=/^(locator|getBy\\w+)$/]',
        ].map((selector) => ({
          selector,
          message: 'Specs must not build locators. Add a method to a page object in src/ui/pages.',
        })),
        ...[
          // async ({ request }) => ..., async ({ request: api }) => ...
          "Property[key.name='request']",
          // page.request, context.request, playwright.request
          "MemberExpression[property.name='request']",
        ].map((selector) => ({
          selector,
          message: 'Specs must not call the API directly. Use a client from src/api/clients.',
        })),
      ],
    },
  },
);
