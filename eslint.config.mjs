import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs, so FlatCompat is no longer
// needed (and no longer works - the shareable config is not an eslintrc object).
const eslintConfig = [
  {
    ignores: [".next/**", "coverage/**", "node_modules/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // eslint-config-next 16 enables this React Compiler rule. Every hit in
      // this codebase is an external-data effect - fetch on mount, poll on an
      // interval, or restore persisted UI state after hydration - not the
      // derived-state antipattern the rule targets. Adopting a data-fetching
      // library (SWR / React Query) would remove the fetch cases for real;
      // until then the rule only reports false positives here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["jest.config.js", "jest.setup.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
