import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "scripts/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      jsdoc,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Style Guide Enforcement ---

      // Long variable and class names
      "id-length": [
        "error",
        { min: 3, exceptions: ["i", "j", "k", "x", "y", "z", "a", "b"] },
      ],

      // No comments (except JSDoc for public API)
      "no-inline-comments": "error",
      "line-comment-position": ["error", { position: "above" }],

      // Methods strictly less than 30 lines (ignoring blank lines)
      "max-lines-per-function": [
        "error",
        { max: 30, skipBlankLines: true, skipComments: true },
      ],

      // Helper function complexity: limit parameters
      "max-params": ["error", 4],

      // Explicit type annotations
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-inferrable-types": "off", // Forces explicit types even for constants

      // Shorthand array syntax (type[])
      "@typescript-eslint/array-type": ["error", { default: "array" }],

      // Avoid any/unknown
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",

      // Explicit accessibility modifiers (public/private)
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "explicit" },
      ],

      // readonly for immutable properties
      "@typescript-eslint/prefer-readonly": "error",

      // JSDoc for public-facing API
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",

      // Private helpers with _ prefix
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "memberLike",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "require",
        },
        {
          selector: "memberLike",
          modifiers: ["public"],
          format: ["camelCase"],
          leadingUnderscore: "forbid",
        },
      ],

      // Structure: Max 4 blank lines (for 5 groups)
      "no-multiple-empty-lines": ["error", { max: 4, maxEOF: 1 }],

      // Enforce blank lines before returns to help separate logic groups
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
      ],
    },
  },
);
