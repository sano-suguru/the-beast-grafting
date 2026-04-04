import type { ShopSlot, ShopItemSlot, OriginId } from "../../shared/types";
import { createSeededRng } from "../../engine/rng";
import { createUnit } from "../../engine/helpers";
import { isEventRound, selectEvent, buildEventShopUnits } from "../../engine/event-helpers";
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
  buildShopForRound,
  deriveRoundSeed,
} from "./shop-generation";
import type { BoardUnit } from "../../shared/board-unit";
import type { ShopSlotJson, ShopItemSlotJson } from "../../db/shop-state-types";

interface ShopBuildResult {
  units: (ShopSlot | null)[];
  items: (ShopItemSlot | null)[];
}

function buildTutorialShop(
  round: number,
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
  return { units, items: generateShopItems(round, prevItems, rng) };
}

function buildNormalShop(
  round: number,
  event: ReturnType<typeof selectEvent> | null,
  originId: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  rng: ReturnType<typeof createSeededRng>,
): ShopBuildResult {
  const result = buildShopForRound(round, event, originId, prevUnits, prevItems, rng);
  const hasEventUnits = event && event.unitOffers.length > 0;
  const units = hasEventUnits
    ? [...result.units, ...buildEventShopUnits(event, round, rng)]
    : result.units;
  return { units, items: result.items };
}

export function executeSetup(
  round: number,
  sanity: number,
  originId: OriginId | null,
  shopSeed: number,
  prevBoard: (BoardUnit | null)[],
  useTutorialShop: boolean,
  prevShopUnits: (ShopSlotJson | null)[],
  prevShopItems: (ShopItemSlotJson | null)[],
): ShopStateRow {
  const rng = createSeededRng(deriveRoundSeed(shopSeed, round));
  const prevUnits = slotsFromJson(prevShopUnits);
  const prevItems = itemSlotsFromJson(prevShopItems);
  const event = !useTutorialShop && isEventRound(round) ? selectEvent(rng) : null;
  const shop = useTutorialShop
    ? buildTutorialShop(round, originId, prevUnits, prevItems, rng)
    : buildNormalShop(round, event, originId, prevUnits, prevItems, rng);

  const rngState = rng.getState();
  return {
    blood: 10 + (event?.bloodBonus ?? 0),
    board: prevBoard,
    shopUnits: slotsToJson(shop.units),
    shopItems: itemSlotsToJson(shop.items),
    freeRoll: (event?.freeRoll ?? false) || originId === "thief",
    cultistUsed: false,
    rotRingUses: 0,
    activeEvent: event,
    rngS0: rngState.s0,
    rngS1: rngState.s1,
    rewardSlots: [],
    undoSnapshot: null,
    round,
    sanity,
  };
}
