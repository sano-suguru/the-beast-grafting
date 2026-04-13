import type { ShopStateResponse } from "../../shared/api-types";
import type { UnitInstance } from "../types";
import { unitInstanceToBoardUnit } from "../../shared/board-unit";
import { ok } from "../../shared/errors";
import { initSession } from "../api/fetch";

export function makeShopState(overrides: Partial<ShopStateResponse> = {}): ShopStateResponse {
  return {
    blood: 10,
    board: [null, null, null, null, null],
    shopUnits: [],
    shopItems: [],
    freeRoll: false,
    cultistUsed: false,
    rotRingUses: 0,
    activeEvent: null,
    rewardSlots: [],
    canUndo: false,
    night: 1,
    life: 5,
    trophy: 0,
    ...overrides,
  };
}

export function toBoardUnit(u: UnitInstance) {
  return unitInstanceToBoardUnit(u);
}

export type RouteHandler = (url: string, init?: RequestInit) => unknown;

export function toUrlString(url: string | URL | Request): string {
  if (typeof url === "string") return url;
  return url instanceof URL ? url.href : url.url;
}

function toResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

const HTTP_ERROR_MARKER = "__httpError" as const;

/** stubFetch ハンドラーからエラーステータスを返すためのマーカー */
export function httpError(status: number) {
  return { [HTTP_ERROR_MARKER]: status };
}

function isHttpError(v: unknown): v is { __httpError: number } {
  return typeof v === "object" && v !== null && HTTP_ERROR_MARKER in v;
}

function routeToResponse(handler: RouteHandler, url: string, init?: RequestInit): Response {
  const body = handler(url, init);
  if (body === undefined) return toResponse({ error: "not found" }, 404);
  if (isHttpError(body)) return toResponse({ error: "fail" }, body.__httpError);
  return toResponse(body, 200);
}

/** globalThis.fetch をモックし、URLパターンに基づいてレスポンスを返す。 */
export function stubFetch(handler: RouteHandler) {
  const spy = vi.fn((url: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(routeToResponse(handler, toUrlString(url), init)),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** ショップ系APIのレスポンスを返すハンドラーを作る */
export function shopRoute(state: ShopStateResponse): RouteHandler {
  return (url) => {
    if (url.startsWith("/api/shop/")) return { shop: state };
    if (url === "/api/lore") return { lore: {} };
    return undefined;
  };
}

/** テスト用: ensureSession の invariant を通過させる */
export function stubSessionRecovery() {
  initSession(() => Promise.resolve(ok(undefined)));
}
