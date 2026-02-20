import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"], 
    languageOptions: { globals: globals.node },
    rules: {
      "no-duplicate-imports": "warn",
      "no-inner-declarations": "warn",
      "no-unreachable-loop": "warn",
      "camelcase": ["error", { properties: "never" }],
      "dot-notation": "warn",
      "eqeqeq": ["error", "always"],
      "func-name-matching": "warn",
      "no-else-return": "warn",
      "no-var": "error",
      "prefer-const": "error",
      "require-await": "warn",
    }
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
]);
