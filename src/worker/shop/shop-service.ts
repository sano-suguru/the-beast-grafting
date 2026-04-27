import type { ShopSlot, ShopItemSlot, OriginId } from "../../shared/types";
import type { Buff } from "../../shared/skill-params";
import { createSeededRng, type StatefulRng } from "../../engine/rng";
import { createUnit } from "../../engine/helpers";
import { applyShopBuffToUnit } from "../../engine/shop-buff";
import { atLevel, TAINTED_PLACENTA, GRAFT_SCION } from "../../shared/skill-params";
import { ITEMS } from "../../shared/data/items";
import { isEventNight, selectEvent, buildEventShopUnits } from "../../engine/event-helpers";
import { applyRevenantBuff, applyAshFungusBuff } from "../../engine/shop-effects-setup";
import {
  applyInquisitorUpgrade,
  generateShopItems,
  buildShopForNight,
  deriveNightSeed,
} from "../../engine/shop-generation";
import type { ShopStateRow } from "./shop-state-row";
import {
  slotsToJson,
  itemSlotsToJson,
  slotsFromJson,
  itemSlotsFromJson,
} from "./shop-serialization";
import type { BoardUnit } from "../../shared/board-unit";
import type { ShopSlotJson, ShopItemSlotJson } from "../../db/shop-state-types";

interface ShopBuildResult {
  units: (ShopSlot | null)[];
  items: (ShopItemSlot | null)[];
}

interface SetupShopParams {
  useTutorialShop: boolean;
  night: number;
  event: ReturnType<typeof selectEvent> | null;
  originId: OriginId | null;
  prevUnits: (ShopSlot | null)[];
  prevItems: (ShopItemSlot | null)[];
  persistentShopBuff: Buff;
  rng: ReturnType<typeof createSeededRng>;
}

function selectSetupEvent(
  useTutorialShop: boolean,
  night: number,
  rng: ReturnType<typeof createSeededRng>,
) {
  if (useTutorialShop || !isEventNight(night)) return null;
  return selectEvent(rng);
}

function buildSetupShop({
  useTutorialShop,
  night,
  event,
  originId,
  prevUnits,
  prevItems,
  persistentShopBuff,
  rng,
}: SetupShopParams): ShopBuildResult {
  if (useTutorialShop) {
    return buildTutorialShop(night, originId, prevUnits, prevItems, persistentShopBuff, rng);
  }
  return buildNormalShop(night, event, originId, prevUnits, prevItems, persistentShopBuff, rng);
}

function prepareSetupBoard(
  prevBoard: (BoardUnit | null)[],
  rng: ReturnType<typeof createSeededRng>,
): (BoardUnit | null)[] {
  const resetBoard = prevBoard.map((bu) => (bu && bu.tempBuffAtk ? { ...bu, tempBuffAtk: 0 } : bu));
  applyRevenantBuff(resetBoard);
  applyAshFungusBuff(resetBoard, rng);
  return resetBoard;
}

function buildSetupState(
  night: number,
  life: number,
  originId: OriginId | null,
  board: (BoardUnit | null)[],
  shop: ShopBuildResult,
  event: ReturnType<typeof selectEvent> | null,
  rng: ReturnType<typeof createSeededRng>,
  placentaBlood: number,
  persistentShopBuff: Buff,
): ShopStateRow {
  const rngState = rng.getState();
  return {
    blood: 10 + (event?.bloodBonus ?? 0) + placentaBlood,
    board,
    shopUnits: slotsToJson(shop.units),
    shopItems: itemSlotsToJson(shop.items),
    shopBuffAtk: persistentShopBuff.atk,
    shopBuffHp: persistentShopBuff.hp,
    freeRoll: (event?.freeRoll ?? false) || originId === "thief",
    cultistUsed: false,
    rotRingUses: 0,
    boneTreeUses: 0,
    corpseBrokerUses: 0,
    activeEvent: event,
    rngS0: rngState.s0,
    rngS1: rngState.s1,
    rewardSlots: [],
    undoSnapshot: null,
    night,
    life,
  };
}

function buildGeneratedShopSlot(
  unitId: Parameters<typeof createUnit>[0],
  persistentShopBuff: Buff,
): ShopSlot {
  return {
    unit: applyShopBuffToUnit(createUnit(unitId), persistentShopBuff),
    frozen: false,
    eventSourced: false,
  };
}

function buildTutorialShop(
  night: number,
  originId: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  persistentShopBuff: Buff,
  rng: ReturnType<typeof createSeededRng>,
): ShopBuildResult {
  const units = applyInquisitorUpgrade(
    [
      prevUnits[0]?.frozen ? prevUnits[0] : buildGeneratedShopSlot("rat", persistentShopBuff),
      prevUnits[1]?.frozen ? prevUnits[1] : buildGeneratedShopSlot("rat", persistentShopBuff),
      prevUnits[2]?.frozen ? prevUnits[2] : buildGeneratedShopSlot("bat", persistentShopBuff),
    ],
    originId,
    rng,
  );
  return { units, items: generateShopItems(night, prevItems, rng) };
}

function appendEventUnits(
  units: (ShopSlot | null)[],
  event: ReturnType<typeof selectEvent> | null,
  night: number,
  persistentShopBuff: Buff,
  rng: StatefulRng,
): (ShopSlot | null)[] {
  if (!event || event.unitOffers.length === 0) return units;
  return [
    ...units,
    ...buildEventShopUnits(event, night, rng).map((slot) => ({
      ...slot,
      unit: applyShopBuffToUnit(slot.unit, persistentShopBuff),
    })),
  ];
}

function buildNormalShop(
  night: number,
  event: ReturnType<typeof selectEvent> | null,
  originId: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  persistentShopBuff: Buff,
  rng: ReturnType<typeof createSeededRng>,
): ShopBuildResult {
  const result = buildShopForNight(
    night,
    event,
    originId,
    prevUnits,
    prevItems,
    persistentShopBuff,
    rng,
  );
  return {
    units: appendEventUnits(result.units, event, night, persistentShopBuff, rng),
    items: result.items,
  };
}

export function buildRolledShop(
  night: number,
  event: ReturnType<typeof selectEvent> | null,
  originId: OriginId | null,
  shopUnits: (ShopSlot | null)[],
  shopItems: (ShopItemSlot | null)[],
  persistentShopBuff: Buff,
  rng: StatefulRng,
): ShopBuildResult {
  const normalPrev = shopUnits.map((slot) => (slot?.eventSourced ? null : slot));
  const frozenEventSlots = shopUnits.filter(
    (slot): slot is ShopSlot => !!slot?.eventSourced && slot.frozen,
  );
  const result = buildShopForNight(
    night,
    event,
    originId,
    normalPrev,
    shopItems,
    persistentShopBuff,
    rng,
  );
  return {
    units: [...result.units, ...frozenEventSlots],
    items: result.items,
  };
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
  prevShopBuffAtk = 0,
  prevShopBuffHp = 0,
): ShopStateRow {
  const rng = createSeededRng(deriveNightSeed(shopSeed, night));
  const prevUnits = slotsFromJson(prevShopUnits);
  const prevItems = itemSlotsFromJson(prevShopItems);
  const persistentShopBuff = { atk: prevShopBuffAtk, hp: prevShopBuffHp };
  const event = selectSetupEvent(useTutorialShop, night, rng);
  const shop = buildSetupShop({
    useTutorialShop,
    night,
    event,
    originId,
    prevUnits,
    prevItems,
    persistentShopBuff,
    rng,
  });

  stockWormItems(prevBoard, shop.items);
  const placentaBlood = calcPlacentaBloodGain(prevBoard);
  const board = prepareSetupBoard(prevBoard, rng);
  return buildSetupState(
    night,
    life,
    originId,
    board,
    shop,
    event,
    rng,
    placentaBlood,
    persistentShopBuff,
  );
}
