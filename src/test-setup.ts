/// <reference types="vite-plus/test/globals" />

import { expect } from "vite-plus/test";

// jest-dom matchers は jsdom 環境でのみ登録
if (typeof document !== "undefined") {
  const { default: _default, ...matchers } = await import("@testing-library/jest-dom/matchers");
  expect.extend(matchers);

  // vitest direct実行時はglobal expectにも拡張
  const g = globalThis as Record<string, unknown>;
  if (g["expect"] && g["expect"] !== expect) {
    (g["expect"] as typeof expect).extend(matchers);
  }
}
