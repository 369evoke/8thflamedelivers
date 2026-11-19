import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Server Components (page.tsx) render once per request on the server, so Date.now()
    // and small local render helpers are safe there. Client components keep the full rules.
    files: ["src/app/**/page.tsx"],
    rules: { "react-hooks/purity": "off", "react-hooks/static-components": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
