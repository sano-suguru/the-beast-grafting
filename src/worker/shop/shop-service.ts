import type { ShopSlot, ShopItemSlot, OriginId, BattleResult } from "../../shared/types";
import { createSeededRng } from "../../engine/rng";
import { createUnit } from "../../engine/helpers";
import { atLevel, TAINTED_PLACENTA, GRAFT_SCION } from "../../shared/skill-params";
import { ITEMS } from "../../shared/data/items";
import { isEventNight, selectEvent, buildEventShopUnits } from "../../engine/event-helpers";
import { applyCatacombRatBuff } from "../../engine/shop-effects-setup";
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

/** tainted_placenta: ターン開始 – blood獲得 */
function calcPlacentaBloodGain(prevBoard: (BoardUnit | null)[]): number {
  let total = 0;
  for (const bu of prevBoard) {
    if (!bu || bu.id !== "tainted_placenta") continue;
    total += atLevel(TAINTED_PLACENTA.bloodGain, bu.level);
  }
  return total;
}

/** graft_scion: ターン開始 – アイテムショップに補充 */
function stockWormItems(prevBoard: (BoardUnit | null)[], shopItems: (ShopItemSlot | null)[]): void {
  for (const bu of prevBoard) {
    if (!bu || bu.id !== "graft_scion") continue;
    const itemId = atLevel(GRAFT_SCION.itemId, bu.level);
    const emptyIdx = shopItems.findIndex((s) => s === null);
    if (emptyIdx === -1) break;
    shopItems[emptyIdx] = { item: ITEMS[itemId], frozen: false };
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
  lastBattleResult: BattleResult = null,
): ShopStateRow {
  const rng = createSeededRng(deriveNightSeed(shopSeed, night));
  const prevUnits = slotsFromJson(prevShopUnits);
  const prevItems = itemSlotsFromJson(prevShopItems);
  const event = !useTutorialShop && isEventNight(night) ? selectEvent(rng) : null;
  const shop = useTutorialShop
    ? buildTutorialShop(night, originId, prevUnits, prevItems, rng)
    : buildNormalShop(night, event, originId, prevUnits, prevItems, rng);

  stockWormItems(prevBoard, shop.items);
  const placentaBlood = calcPlacentaBloodGain(prevBoard);

  const rngState = rng.getState();
  const resetBoard = prevBoard.map((bu) => (bu && bu.tempBuffAtk ? { ...bu, tempBuffAtk: 0 } : bu));
  applyCatacombRatBuff(resetBoard, lastBattleResult);
  return {
    blood: 10 + (event?.bloodBonus ?? 0) + placentaBlood,
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
