import {
  EVENT_SCHEDULE,
  isEventRound,
  selectEvent,
  buildEventShopUnits,
  buildEventShopItems,
} from "./event-helpers";
import { EVENTS } from "../data/events";
import { ROTTING_CARGO_CEILING_BONUS } from "./constants";

describe("EVENT_SCHEDULE", () => {
  it("contains 4, 8, 12, 16", () => {
    expect(EVENT_SCHEDULE).toContain(4);
    expect(EVENT_SCHEDULE).toContain(8);
    expect(EVENT_SCHEDULE).toContain(12);
    expect(EVENT_SCHEDULE).toContain(16);
  });
});

describe("isEventRound", () => {
  it("returns true for event rounds", () => {
    expect(isEventRound(4)).toBe(true);
    expect(isEventRound(8)).toBe(true);
    expect(isEventRound(12)).toBe(true);
    expect(isEventRound(16)).toBe(true);
  });

  it("returns false for non-event rounds", () => {
    expect(isEventRound(1)).toBe(false);
    expect(isEventRound(3)).toBe(false);
    expect(isEventRound(5)).toBe(false);
    expect(isEventRound(7)).toBe(false);
    expect(isEventRound(10)).toBe(false);
  });
});

describe("selectEvent", () => {
  it("returns a valid EventData", () => {
    const event = selectEvent();
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
    const result = buildEventShopUnits(EVENTS.vial, 4);
    expect(result).toHaveLength(0);
  });

  it("builds slots from rotting_cargo offers", () => {
    const result = buildEventShopUnits(EVENTS.rotting_cargo, 4);
    expect(result).toHaveLength(2);
    expect(result.every((s) => s !== null)).toBe(true);
    result.forEach((slot) => {
      expect(slot!.unit.equip).toBe("infection");
      expect(slot!.costOverride).toBe(2);
    });
  });

  it("applies atkBonus and hpBonus", () => {
    const event = {
      ...EVENTS.rotting_cargo,
      unitOffers: [
        {
          unitId: "rat" as const,
          tier: 1,
          cost: 2,
          equipOverride: "infection" as const,
          atkBonus: 2,
          hpBonus: 3,
        },
      ],
    };
    const result = buildEventShopUnits(event, 4);
    const slot = result[0];
    expect(slot).not.toBeNull();
    expect(slot!.unit.atk).toBeGreaterThanOrEqual(2);
    expect(slot!.unit.hp).toBeGreaterThanOrEqual(3);
  });

  it("applies ceiling bonus at round 12 when tier is auto-resolved", () => {
    const result = buildEventShopUnits(EVENTS.rotting_cargo, 12);
    result.forEach((slot) => {
      expect(slot).not.toBeNull();
      expect(slot!.unit.atk).toBeGreaterThanOrEqual(ROTTING_CARGO_CEILING_BONUS.atk);
      expect(slot!.unit.hp).toBeGreaterThanOrEqual(ROTTING_CARGO_CEILING_BONUS.hp);
    });
  });

  it("does not apply ceiling bonus at round 4", () => {
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
    const result = buildEventShopUnits(event, 4);
    const slot = result[0]!;
    expect(slot.unit.id).toBe("rat");
    expect(slot.unit.atk).toBe(2);
    expect(slot.unit.hp).toBe(2);
  });

  it("does not apply ceiling bonus when tier is explicitly set", () => {
    const event = {
      ...EVENTS.rotting_cargo,
      unitOffers: [
        {
          unitId: "rat" as const,
          tier: 3,
          cost: 2,
          equipOverride: "infection" as const,
          atkBonus: 0,
          hpBonus: 0,
        },
      ],
    };
    const result = buildEventShopUnits(event, 12);
    const slot = result[0]!;
    expect(slot.unit.id).toBe("rat");
    expect(slot.unit.atk).toBe(2);
    expect(slot.unit.hp).toBe(2);
  });
});

describe("buildEventShopItems", () => {
  it("returns empty array for events with no itemOffers", () => {
    const result = buildEventShopItems(EVENTS.rotting_cargo);
    expect(result).toHaveLength(0);
  });

  it("builds free item slot for patrol", () => {
    const result = buildEventShopItems(EVENTS.patrol);
    expect(result).toHaveLength(1);
    const slot = result[0];
    expect(slot).not.toBeNull();
    expect(slot!.item.cost).toBe(0);
  });
});
