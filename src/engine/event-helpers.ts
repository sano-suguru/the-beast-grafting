import type { EventData, EventId, ShopSlot, ShopItemSlot } from "../shared/types";
import type { Rng } from "./rng";
import { EVENTS } from "../shared/data/events";
import { ITEMS } from "../shared/data/items";
import { createUnit, getUnitsByTier, getItemPool, pickRandom, getCurrentMaxTier } from "./helpers";
import { UNIT_COST, ROTTING_CARGO_CEILING_BONUS } from "./constants";

export const EVENT_SCHEDULE: readonly number[] = [4, 8, 12, 16];

export function isEventRound(round: number): boolean {
  return EVENT_SCHEDULE.includes(round);
}

function getTierAboveCurrent(round: number): number {
  return Math.min(6, getCurrentMaxTier(round) + 1);
}

const EVENT_IDS = Object.keys(EVENTS) as EventId[];

export function selectEvent(rng: Rng): EventData {
  return EVENTS[pickRandom(EVENT_IDS, rng)];
}

export function buildEventShopUnits(event: EventData, round: number, rng: Rng): ShopSlot[] {
  const atCeiling = getCurrentMaxTier(round) >= 6;
  return event.unitOffers.map((offer) => {
    const autoTier = offer.tier == null;
    let unitId: Parameters<typeof createUnit>[0];
    if (offer.unitId === "random") {
      const tier = autoTier ? getTierAboveCurrent(round) : offer.tier!;
      const candidates = getUnitsByTier(tier);
      unitId = pickRandom([...candidates], rng);
    } else {
      unitId = offer.unitId;
    }
    const unit = createUnit(unitId);
    const ceilingBonus = atCeiling && autoTier ? ROTTING_CARGO_CEILING_BONUS : null;
    const boostedUnit = {
      ...unit,
      equip: offer.equipOverride ?? unit.equip,
      atk: unit.atk + offer.atkBonus + (ceilingBonus?.atk ?? 0),
      hp: unit.hp + offer.hpBonus + (ceilingBonus?.hp ?? 0),
    };
    return {
      unit: boostedUnit,
      frozen: false,
      ...(offer.cost !== UNIT_COST ? { costOverride: offer.cost } : {}),
    };
  });
}

export function buildEventShopItems(event: EventData, rng: Rng): ShopItemSlot[] {
  const pool = getItemPool();
  return event.itemOffers.map((offer) => {
    const itemId = offer.itemId === "random" ? pickRandom(pool, rng) : offer.itemId;
    const item = ITEMS[itemId];
    return { item: { ...item, cost: offer.cost }, frozen: false };
  });
}
