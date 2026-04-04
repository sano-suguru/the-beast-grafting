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

function resolveUnitId(
  offer: EventData["unitOffers"][number],
  round: number,
  rng: Rng,
): Parameters<typeof createUnit>[0] {
  if (offer.unitId !== "random") return offer.unitId;
  const autoTier = offer.tier == null;
  const tier = autoTier ? getTierAboveCurrent(round) : offer.tier!;
  return pickRandom([...getUnitsByTier(tier)], rng);
}

function boostUnit(
  unit: ReturnType<typeof createUnit>,
  offer: EventData["unitOffers"][number],
  atCeiling: boolean,
) {
  const autoTier = offer.tier == null;
  const ceilingBonus = atCeiling && autoTier ? ROTTING_CARGO_CEILING_BONUS : null;
  return {
    ...unit,
    equip: offer.equipOverride ?? unit.equip,
    buffAtk: unit.buffAtk + offer.atkBonus + (ceilingBonus?.atk ?? 0),
    buffHp: unit.buffHp + offer.hpBonus + (ceilingBonus?.hp ?? 0),
  };
}

export function buildEventShopUnits(event: EventData, round: number, rng: Rng): ShopSlot[] {
  const atCeiling = getCurrentMaxTier(round) >= 6;
  return event.unitOffers.map((offer) => {
    const unitId = resolveUnitId(offer, round, rng);
    const unit = boostUnit(createUnit(unitId), offer, atCeiling);
    return {
      unit,
      frozen: false,
      ...(offer.cost !== UNIT_COST ? { costOverride: offer.cost } : {}),
      eventSourced: true,
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
