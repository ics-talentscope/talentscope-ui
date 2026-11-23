import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Type errors are covered by `npm run typecheck`. The existing codebase also
// predates the TypeScript ESLint recommended rules, so keep lint focused on
// Next.js/React correctness and avoid turning that backlog into CI failures.
// React Compiler's experimental rules are likewise disabled; the classic
// rules-of-hooks and exhaustive-deps checks remain enabled by nextVitals.
const reactCompilerRules = [
  "react-hooks/static-components",
  "react-hooks/use-memo",
  "react-hooks/preserve-manual-memoization",
  "react-hooks/incompatible-library",
  "react-hooks/immutability",
  "react-hooks/globals",
  "react-hooks/refs",
  "react-hooks/set-state-in-effect",
  "react-hooks/error-boundaries",
  "react-hooks/purity",
  "react-hooks/set-state-in-render",
  "react-hooks/unsupported-syntax",
  "react-hooks/config",
  "react-hooks/gating",
];

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      ...Object.fromEntries(reactCompilerRules.map((rule) => [rule, "off"])),
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
