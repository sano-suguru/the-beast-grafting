/// <reference types="vite-plus/test/globals" />
/// <reference types="node" />

import { expect } from "vite-plus/test";

// Workers 互換: crypto.subtle.timingSafeEqual polyfill (Node.js 環境)
const subtle = globalThis.crypto?.subtle;
if (subtle && typeof subtle.timingSafeEqual !== "function") {
  const nodeCrypto = await import("node:crypto");
  subtle.timingSafeEqual = (a: ArrayBuffer, b: ArrayBuffer): boolean =>
    nodeCrypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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
