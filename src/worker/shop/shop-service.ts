import type { ShopSlot, ShopItemSlot, OriginId } from "../../shared/types";
import { createSeededRng } from "../../engine/rng";
import type { Rng } from "../../engine/rng";
import { createUnit } from "../../engine/helpers";
import { atLevel, TAINTED_PLACENTA } from "../../shared/skill-params";
import { isEventNight, selectEvent, buildEventShopUnits } from "../../engine/event-helpers";
import type { ShopStateRow } from "./shop-state-row";
import {
  slotsToJson,
  itemSlotsToJson,
  slotsFromJson,
  itemSlotsFromJson,
} from "./shop-serialization";
import {
  applyInquisitorUpgrade,
  generateShopItems,
  buildShopForNight,
  deriveNightSeed,
} from "./shop-generation";
import type { BoardUnit } from "../../shared/board-unit";
import type { ShopSlotJson, ShopItemSlotJson } from "../../db/shop-state-types";

interface ShopBuildResult {
  units: (ShopSlot | null)[];
  items: (ShopItemSlot | null)[];
}

function buildTutorialShop(
  night: number,
  originId: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  rng: ReturnType<typeof createSeededRng>,
): ShopBuildResult {
  const units = applyInquisitorUpgrade(
    [
      prevUnits[0]?.frozen
        ? prevUnits[0]
        : { unit: createUnit("rat"), frozen: false, eventSourced: false },
      prevUnits[1]?.frozen
        ? prevUnits[1]
        : { unit: createUnit("rat"), frozen: false, eventSourced: false },
      prevUnits[2]?.frozen
        ? prevUnits[2]
        : { unit: createUnit("bat"), frozen: false, eventSourced: false },
    ],
    originId,
    rng,
  );
  return { units, items: generateShopItems(night, prevItems, rng) };
}

function buildNormalShop(
  night: number,
  event: ReturnType<typeof selectEvent> | null,
  originId: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  rng: ReturnType<typeof createSeededRng>,
): ShopBuildResult {
  const result = buildShopForNight(night, event, originId, prevUnits, prevItems, rng);
  const hasEventUnits = event && event.unitOffers.length > 0;
  const units = hasEventUnits
    ? [...result.units, ...buildEventShopUnits(event, night, rng)]
    : result.units;
  return { units, items: result.items };
}

function applyTaintedPlacentaSetupBuff(
  prevBoard: (BoardUnit | null)[],
  shopUnits: (ShopSlot | null)[],
  rng: Rng,
): void {
  const active = shopUnits.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  if (active.length === 0) return;
  for (const bu of prevBoard) {
    if (!bu || bu.id !== "tainted_placenta") continue;
    const b = atLevel(TAINTED_PLACENTA.shopBuff, bu.level);
    const idx = active[Math.floor(rng.next() * active.length)]!;
    const target = shopUnits[idx]!;
    target.unit.buffAtk += b.atk;
    target.unit.buffHp += b.hp;
  }
}

export function executeSetup(
  night: number,
  life: number,
  originId: OriginId | null,
  shopSeed: number,
  prevBoard: (BoardUnit | null)[],
  useTutorialShop: boolean,
  prevShopUnits: (ShopSlotJson | null)[],
  prevShopItems: (ShopItemSlotJson | null)[],
): ShopStateRow {
  const rng = createSeededRng(deriveNightSeed(shopSeed, night));
  const prevUnits = slotsFromJson(prevShopUnits);
  const prevItems = itemSlotsFromJson(prevShopItems);
  const event = !useTutorialShop && isEventNight(night) ? selectEvent(rng) : null;
  const shop = useTutorialShop
    ? buildTutorialShop(night, originId, prevUnits, prevItems, rng)
    : buildNormalShop(night, event, originId, prevUnits, prevItems, rng);

  applyTaintedPlacentaSetupBuff(prevBoard, shop.units, rng);

  const rngState = rng.getState();
  const resetBoard = prevBoard.map((bu) => (bu && bu.tempBuffAtk ? { ...bu, tempBuffAtk: 0 } : bu));
  return {
    blood: 10 + (event?.bloodBonus ?? 0),
    board: resetBoard,
    shopUnits: slotsToJson(shop.units),
    shopItems: itemSlotsToJson(shop.items),
    freeRoll: (event?.freeRoll ?? false) || originId === "thief",
    cultistUsed: false,
    rotRingUses: 0,
    boneTreeUses: 0,
    activeEvent: event,
    rngS0: rngState.s0,
    rngS1: rngState.s1,
    rewardSlots: [],
    undoSnapshot: null,
    night,
    life,
  };
}
