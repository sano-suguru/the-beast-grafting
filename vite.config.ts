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
  lint: { options: { denyWarnings: true, typeAware: true, typeCheck: true } },
  plugins: [preact(), tailwindcss(), !process.env["VITEST"] && cloudflare()].filter(Boolean),
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      include: ["src/app/engine/**", "src/app/state/**", "src/worker/**"],
      exclude: ["src/app/engine/audio.ts", "**/*.test.{ts,tsx}"],
      reporter: ["text", "html"],
    },
  },
});
