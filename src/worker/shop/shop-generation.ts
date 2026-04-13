import type { ShopSlot, ShopItemSlot, EventData, OriginId } from "../../shared/types";
import { unitInstanceToBoardUnit } from "../../shared/board-unit";
import { invariant } from "../../shared/invariant";
import { ITEMS } from "../../shared/data/items";
import { getCurrentMaxTier, nextTier } from "../../shared/data/tiers";
import type { StatefulRng } from "../../engine/rng";
import {
  createUnit,
  getShopPool,
  getItemPool,
  getUnitsByTier,
  pickRandom,
} from "../../engine/helpers";
import { buildEventShopItems } from "../../engine/event-helpers";
import {
  SHOP_SIZES,
  SHOP_SIZE_DEFAULT,
  ITEM_SHOP_SIZES,
  ITEM_SHOP_SIZE_DEFAULT,
  LEVEL_UP_REWARD_COUNT,
} from "../../engine/constants";
import type { ShopSlotJson } from "../../db/shop-state-types";

function getShopSize(r: number): number {
  for (const { minNight, size } of SHOP_SIZES) {
    if (r >= minNight) return size;
  }
  return SHOP_SIZE_DEFAULT;
}

function generateShopUnits(
  r: number,
  prev: (ShopSlot | null)[],
  sizeModifier: number,
  rng: StatefulRng,
): (ShopSlot | null)[] {
  const pool = getShopPool(r);
  const size = Math.max(0, getShopSize(r) + sizeModifier);
  return [...Array(size).keys()].map((i) => {
    if (prev[i]?.frozen) return prev[i];
    return { unit: createUnit(pickRandom(pool, rng)), frozen: false, eventSourced: false };
  });
}

export function applyInquisitorUpgrade(
  units: (ShopSlot | null)[],
  currentOrigin: OriginId | null,
  rng: StatefulRng,
): (ShopSlot | null)[] {
  if (currentOrigin !== "inquisitor") return units;
  const candidates = units
    .map((s, i) => (s && !s.frozen && s.unit.tier < 6 ? i : -1))
    .filter((i) => i >= 0);
  if (candidates.length === 0) return units;
  const targetIdx = pickRandom(candidates, rng);
  const slot = units[targetIdx];
  if (!slot) return units;
  const higherTier = getUnitsByTier(nextTier(slot.unit.tier));
  if (higherTier.length === 0) return units;
  const newId = pickRandom([...higherTier], rng);
  const next = [...units];
  next[targetIdx] = { unit: createUnit(newId), frozen: slot.frozen, eventSourced: false };
  return next;
}

export function generateShopItems(
  r: number,
  prev: (ShopItemSlot | null)[],
  rng: StatefulRng,
): (ShopItemSlot | null)[] {
  const itemPool = getItemPool();
  const size = r >= ITEM_SHOP_SIZES[0].minNight ? ITEM_SHOP_SIZES[0].size : ITEM_SHOP_SIZE_DEFAULT;
  return [...Array(size).keys()].map((i) => {
    const existing = prev[i];
    if (existing?.frozen) return existing;
    const item = ITEMS[pickRandom(itemPool, rng)];
    return { item, frozen: false };
  });
}

export function buildShopForNight(
  currentNight: number,
  event: EventData | null,
  currentOrigin: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  rng: StatefulRng,
): { units: (ShopSlot | null)[]; items: (ShopItemSlot | null)[] } {
  const sizeModifier = event?.shopSizeModifier ?? 0;
  let units: (ShopSlot | null)[] = generateShopUnits(currentNight, prevUnits, sizeModifier, rng);
  units = applyInquisitorUpgrade(units, currentOrigin, rng);

  if (event?.shopUnitBuff) {
    const buff = event.shopUnitBuff;
    units = units.map((slot) =>
      slot && !slot.frozen
        ? {
            ...slot,
            unit: {
              ...slot.unit,
              baseAtk: slot.unit.baseAtk + buff.atk,
              baseHp: slot.unit.baseHp + buff.hp,
            },
          }
        : slot,
    );
  }

  const items =
    event && event.itemOffers.length > 0
      ? buildEventShopItems(event, rng)
      : generateShopItems(currentNight, prevItems, rng);

  return { units, items };
}

export function deriveNightSeed(shopSeed: number, night: number): number {
  invariant(night >= 1, `deriveNightSeed: night must be >= 1, got ${night}`);
  const mixed = (shopSeed ^ Math.imul(night, 0x9e3779b9)) | 0;
  return mixed === 0 ? 1 : mixed;
}

export function generateLevelUpRewards(
  leveledUp: boolean,
  night: number,
  rng: StatefulRng,
): ShopSlotJson[] {
  if (!leveledUp) return [];
  const rewardTier = nextTier(getCurrentMaxTier(night));
  const candidates = getUnitsByTier(rewardTier);
  if (candidates.length === 0) return [];
  return Array.from({ length: LEVEL_UP_REWARD_COUNT }, () => ({
    unit: unitInstanceToBoardUnit(createUnit(pickRandom([...candidates], rng))),
    frozen: false,
    eventSourced: false,
  }));
}
