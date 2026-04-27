import {
  EVENT_SCHEDULE,
  isEventNight,
  selectEvent,
  buildEventShopUnits,
  buildEventShopItems,
} from "./event-helpers";
import { EVENTS } from "../shared/data/events";
import { ROTTING_CARGO_CEILING_BONUS } from "./constants";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { createSeededRng } from "./rng";

describe("EVENT_SCHEDULE", () => {
  it("contains 4, 8, 12, 16", () => {
    expect(EVENT_SCHEDULE).toContain(4);
    expect(EVENT_SCHEDULE).toContain(8);
    expect(EVENT_SCHEDULE).toContain(12);
    expect(EVENT_SCHEDULE).toContain(16);
  });
});

describe("isEventNight", () => {
  it("returns true for event nights", () => {
    expect(isEventNight(4)).toBe(true);
    expect(isEventNight(8)).toBe(true);
    expect(isEventNight(12)).toBe(true);
    expect(isEventNight(16)).toBe(true);
  });

  it("returns false for non-event nights", () => {
    expect(isEventNight(1)).toBe(false);
    expect(isEventNight(3)).toBe(false);
    expect(isEventNight(5)).toBe(false);
    expect(isEventNight(7)).toBe(false);
    expect(isEventNight(10)).toBe(false);
  });
});

describe("selectEvent", () => {
  it("returns a valid EventData", () => {
    const event = selectEvent(createSeededRng(42));
    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.narrative).toBeDefined();
  });

  it("uses rng to select event", () => {
    const first = selectEvent({ next: () => 0 });
    const last = selectEvent({ next: () => 0.99 });
    expect(first).toBeDefined();
    expect(last).toBeDefined();
  });

  it("returns each event based on rng bucket", () => {
    const eventIds = new Set([0, 0.2, 0.4, 0.6, 0.8].map((r) => selectEvent({ next: () => r }).id));
    expect(eventIds.size).toBeGreaterThan(1);
  });
});

describe("buildEventShopUnits", () => {
  it("returns empty array for events with no unitOffers", () => {
    const result = buildEventShopUnits(EVENTS.vial, 4, createSeededRng(42));
    expect(result).toHaveLength(0);
  });

  it("builds slots from rotting_cargo offers", () => {
    const result = buildEventShopUnits(EVENTS.rotting_cargo, 4, createSeededRng(42));
    expect(result).toHaveLength(2);
    expect(result.every((s) => s !== null)).toBe(true);
    result.forEach((slot) => {
      expect(slot!.unit.equip).toBe("infection");
      expect(slot!.costOverride).toBe(2);
      expect(slot!.eventSourced).toBe(true);
    });
  });

  it("applies atkBonus and hpBonus", () => {
    const event = {
      ...EVENTS.rotting_cargo,
      unitOffers: [
        {
          unitId: "rat" as const,
          tier: 1 as const,
          cost: 2,
          equipOverride: "infection" as const,
          atkBonus: 2,
          hpBonus: 3,
        },
      ],
    };
    const result = buildEventShopUnits(event, 4, createSeededRng(42));
    const slot = result[0];
    expect(slot).not.toBeNull();
    expect(effectiveAtk(slot!.unit)).toBeGreaterThanOrEqual(2);
    expect(effectiveHp(slot!.unit)).toBeGreaterThanOrEqual(3);
  });

  it("applies ceiling bonus at night 12 when tier is auto-resolved", () => {
    const result = buildEventShopUnits(EVENTS.rotting_cargo, 12, createSeededRng(42));
    result.forEach((slot) => {
      expect(slot).not.toBeNull();
      expect(effectiveAtk(slot!.unit)).toBeGreaterThanOrEqual(ROTTING_CARGO_CEILING_BONUS.atk);
      expect(effectiveHp(slot!.unit)).toBeGreaterThanOrEqual(ROTTING_CARGO_CEILING_BONUS.hp);
    });
  });

  it("does not apply ceiling bonus at night 4", () => {
    const event = {
      ...EVENTS.rotting_cargo,
      unitOffers: [
        {
          unitId: "rat" as const,
          cost: 2,
          equipOverride: "infection" as const,
          atkBonus: 0,
          hpBonus: 0,
        },
      ],
    };
    const result = buildEventShopUnits(event, 4, createSeededRng(42));
    const slot = result[0]!;
    expect(slot.unit.id).toBe("rat");
    expect(effectiveAtk(slot.unit)).toBe(2);
    expect(effectiveHp(slot.unit)).toBe(2);
  });

  it("does not apply ceiling bonus when tier is explicitly set", () => {
    const event = {
      ...EVENTS.rotting_cargo,
      unitOffers: [
        {
          unitId: "rat" as const,
          tier: 3 as const,
          cost: 2,
          equipOverride: "infection" as const,
          atkBonus: 0,
          hpBonus: 0,
        },
      ],
    };
    const result = buildEventShopUnits(event, 12, createSeededRng(42));
    const slot = result[0]!;
    expect(slot.unit.id).toBe("rat");
    expect(effectiveAtk(slot.unit)).toBe(2);
    expect(effectiveHp(slot.unit)).toBe(2);
  });
});

describe("buildEventShopItems", () => {
  it("returns empty array for events with no itemOffers", () => {
    const result = buildEventShopItems(EVENTS.rotting_cargo, 12, createSeededRng(42));
    expect(result).toHaveLength(0);
  });

  it("builds free item slot for patrol", () => {
    const result = buildEventShopItems(EVENTS.patrol, 8, createSeededRng(42));
    expect(result).toHaveLength(1);
    const slot = result[0];
    expect(slot).not.toBeNull();
    expect(slot!.item.cost).toBe(0);
  });
});
