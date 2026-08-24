// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

const nodeGlobals = {
  require: "readonly",
  module: "writable",
  exports: "writable",
  process: "readonly",
  console: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
};

module.exports = tseslint.config(
  {
    ignores: [
      "out/**",
      "node_modules/**",
      "media/**",
      "scripts/**",
      ".vscode-test/**",
      "webview/main.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: { globals: nodeGlobals },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "all" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
