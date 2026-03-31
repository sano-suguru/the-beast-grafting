import { apiFetch } from "./fetch";
import type { Result, InfraError } from "../../shared/errors";
import type { ShopStateResponse } from "../../shared/api-types";

function shopFetch(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Result<ShopStateResponse, InfraError>> {
  return apiFetch<{ shop: ShopStateResponse }>(`/api/shop/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.map((d) => d.shop));
}

export function setupShop(
  runId: string,
  useTutorialShop = false,
): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("setup", { runId, useTutorialShop });
}

export function rollShop(runId: string): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("roll", { runId });
}

export function buyUnit(
  runId: string,
  shopIndex: number,
  boardIndex: number,
): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("buy", { runId, shopIndex, boardIndex });
}

export function sellUnit(
  runId: string,
  boardIndex: number,
): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("sell", { runId, boardIndex });
}

export function equipItem(
  runId: string,
  shopItemIndex: number,
  boardIndex: number,
): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("equip", { runId, shopItemIndex, boardIndex });
}

export function freezeSlot(
  runId: string,
  isUnit: boolean,
  index: number,
  frozen: boolean,
): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("freeze", { runId, isUnit, index, frozen });
}

export function swapBoard(
  runId: string,
  fromIndex: number,
  toIndex: number,
): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("swap", { runId, fromIndex, toIndex });
}

export function useCultist(runId: string): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("cultist", { runId });
}

export function undoAction(runId: string): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("undo", { runId });
}

export function readyForBattle(runId: string): Promise<Result<ShopStateResponse, InfraError>> {
  return shopFetch("ready", { runId });
}

export function getShopState(runId: string): Promise<Result<ShopStateResponse, InfraError>> {
  return apiFetch<{ shop: ShopStateResponse }>(
    `/api/shop/state?runId=${encodeURIComponent(runId)}`,
  ).then((r) => r.map((d) => d.shop));
}
