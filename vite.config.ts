import { defineConfig } from "vite-plus";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: true,
    singleQuote: false,
    tabWidth: 2,
    useTabs: false,
    trailingComma: "all",
    printWidth: 100,
    sortTailwindcss: {},
  },
  lint: {
    jsPlugins: ["oxlint-plugin-eslint"],
    rules: {
      "eslint-js/no-restricted-syntax": [
        "error",
        { selector: "ThrowStatement", message: "Use neverthrow Result instead of throw" },
        { selector: "TryStatement", message: "Use neverthrow fromThrowable instead of try/catch" },
      ],
      "typescript/no-explicit-any": "error",
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      complexity: ["error", { max: 10 }],
      "max-depth": ["error", { max: 4 }],
      "no-var": "error",
      "prefer-const": "error",
      "no-console": "error",
      "no-alert": "error",
      "no-param-reassign": "error",
      "no-nested-ternary": "error",
      "import/no-duplicates": "error",
      "import/no-mutable-exports": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-empty-object-type": "error",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/catch-error-name": "error",
      "unicorn/error-message": "error",
      "unicorn/prefer-optional-catch-binding": "error",
      "react/self-closing-comp": "error",
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/button-has-type": "error",
      "no-unused-vars": [
        "error",
        {
          args: "all",
          caughtErrors: "all",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
        rules: { "max-lines": "off", "max-lines-per-function": "off" },
      },
    ],
    options: { denyWarnings: true, typeAware: true, typeCheck: true },
  },
  plugins: [preact(), tailwindcss(), !process.env["VITEST"] && cloudflare()].filter(Boolean),
  test: {
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      include: ["src/engine/**", "src/shared/data/**", "src/app/state/**", "src/worker/**"],
      exclude: ["**/*.test.{ts,tsx}"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/worker/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "worker-unit",
          include: ["src/worker/**/*.test.ts"],
          exclude: ["src/worker/**/*.d1.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "worker-db",
          include: ["src/worker/**/*.d1.test.ts"],
          environment: "node",
          pool: "forks",
          globalSetup: ["src/worker/test-global-setup.ts"],
          // pool:"forks" — each process gets its own Miniflare instance.
          // maxWorkers:1 keeps a single process so startup cost is paid once.
          maxWorkers: 1,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
