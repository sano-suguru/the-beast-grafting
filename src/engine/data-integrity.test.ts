import { UNITS } from "../shared/data/units";
import { CHURCH_UNITS } from "../shared/data/church-units";
import { ITEMS } from "../shared/data/items";
import { EQUIPS } from "../shared/data/equips";
import type { EquipType } from "../shared/types";
import { ORIGINS } from "../shared/data/origins";
import { CHALICE } from "../shared/skill-params";
import { UNIT_DEATH_HANDLERS } from "./battle-deaths-handlers";
import { getUnitsByTier, getShopPool, getItemPool } from "./helpers";
import { TIERS } from "../shared/data/tiers";
import { INERT_UNIT_ID } from "./test-helpers";

describe("UNITS data integrity", () => {
  const entries = Object.entries(UNITS);

  it("contains exactly 60 units", () => {
    expect(entries).toHaveLength(60);
  });

  it("every unit's id matches its record key", () => {
    for (const [key, data] of entries) {
      expect(data.id).toBe(key);
    }
  });

  it("every unit has non-negative baseAtk and positive baseHp", () => {
    for (const [key, data] of entries) {
      expect(data.baseAtk, `${key}.baseAtk`).toBeGreaterThanOrEqual(0);
      expect(data.baseHp, `${key}.baseHp`).toBeGreaterThan(0);
    }
  });

  it("every unit has tier in range 1-6", () => {
    for (const [key, data] of entries) {
      expect(data.tier, `${key}.tier`).toBeGreaterThanOrEqual(1);
      expect(data.tier, `${key}.tier`).toBeLessThanOrEqual(6);
    }
  });

  it("every unit has non-empty name, skillText, and lore", () => {
    for (const [key, data] of entries) {
      expect(data.name.length, `${key}.name`).toBeGreaterThan(0);
      expect(data.skillText.length, `${key}.skillText`).toBeGreaterThan(0);
      expect(data.lore.length, `${key}.lore`).toBeGreaterThan(0);
    }
  });

  it("tier distribution is 10/10/10/10/10/10 (tier 1-6, total 60)", () => {
    const counts: Record<number, number> = {};
    for (const [, data] of entries) counts[data.tier] = (counts[data.tier] ?? 0) + 1;
    expect(counts).toEqual({ 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 });
  });

  it("no duplicate names across units", () => {
    const names = entries.map(([, d]) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("CHURCH_UNITS data integrity", () => {
  const entries = Object.entries(CHURCH_UNITS);

  it("contains exactly 14 units", () => {
    expect(entries).toHaveLength(14);
  });

  it("every church unit has tier in range 1-6", () => {
    for (const [key, data] of entries) {
      expect(data.tier, `${key}.tier`).toBeGreaterThanOrEqual(1);
      expect(data.tier, `${key}.tier`).toBeLessThanOrEqual(6);
    }
  });

  it("every church unit's id matches its record key", () => {
    for (const [key, data] of entries) {
      expect(data.id).toBe(key);
    }
  });

  it("every church unit has positive baseAtk and baseHp", () => {
    for (const [key, data] of entries) {
      expect(data.baseAtk, `${key}.baseAtk`).toBeGreaterThan(0);
      expect(data.baseHp, `${key}.baseHp`).toBeGreaterThan(0);
    }
  });
});

describe("ITEMS data integrity", () => {
  const entries = Object.entries(ITEMS);

  it("contains exactly 12 items", () => {
    expect(entries).toHaveLength(12);
  });

  it("every item has non-negative cost", () => {
    for (const [key, data] of entries) {
      expect(data.cost, `${key}.cost`).toBeGreaterThanOrEqual(0);
    }
  });

  it("every item's id matches its record key", () => {
    for (const [key, data] of entries) {
      expect(data.id).toBe(key);
    }
  });

  it("every item has non-negative atk and hp", () => {
    for (const [key, data] of entries) {
      expect(data.atk, `${key}.atk`).toBeGreaterThanOrEqual(0);
      expect(data.hp, `${key}.hp`).toBeGreaterThanOrEqual(0);
    }
  });

  const VALID_EQUIPS = new Set<EquipType | null>([...(Object.keys(EQUIPS) as EquipType[]), null]);

  it("every item's equip is a valid EquipType or null", () => {
    for (const [key, data] of entries) {
      expect(VALID_EQUIPS.has(data.equip), `${key}.equip="${data.equip}" is invalid`).toBe(true);
    }
  });

  it("pure_blood has cost 0 (free item)", () => {
    expect(ITEMS["pure_blood"]!.cost).toBe(0);
  });

  it("CHALICE.buff matches pure_blood item stats", () => {
    const ids = ["pure_blood", "pure_blood_2", "pure_blood_3"] as const;
    ids.forEach((id, i) => {
      expect(CHALICE.buff[i]!.atk, `${id}.atk`).toBe(ITEMS[id]!.atk);
      expect(CHALICE.buff[i]!.hp, `${id}.hp`).toBe(ITEMS[id]!.hp);
    });
  });
});

describe("ORIGINS data integrity", () => {
  const entries = Object.entries(ORIGINS);
  const VALID_IDS = new Set(["thief", "inquisitor", "surgeon", "cultist"]);

  it("contains exactly 4 origins", () => {
    expect(entries).toHaveLength(4);
  });

  it("origin ids match the OriginId type", () => {
    for (const [key] of entries) {
      expect(VALID_IDS.has(key), `unexpected origin id: ${key}`).toBe(true);
    }
  });

  it("every origin has non-empty name, desc, and lore", () => {
    for (const [key, data] of entries) {
      expect(data.name.length, `${key}.name`).toBeGreaterThan(0);
      expect(data.desc.length, `${key}.desc`).toBeGreaterThan(0);
      expect(data.lore.length, `${key}.lore`).toBeGreaterThan(0);
    }
  });
});

describe("Cross-reference integrity", () => {
  it("every unit ID in UNIT_DEATH_HANDLERS exists in UNITS or CHURCH_UNITS", () => {
    for (const key of Object.keys(UNIT_DEATH_HANDLERS)) {
      const exists = key in UNITS || key in CHURCH_UNITS;
      expect(exists, `handler for "${key}" but unit not found`).toBe(true);
    }
  });

  it("getUnitsByTier returns valid UNITS IDs for each tier", () => {
    for (const tier of TIERS) {
      const ids = getUnitsByTier(tier);
      expect(ids.length, `tier ${tier} should have units`).toBeGreaterThan(0);
      for (const id of ids) {
        expect(id in UNITS, `getUnitsByTier(${tier}) returned "${id}" not in UNITS`).toBe(true);
      }
    }
  });

  it("getShopPool returns valid UNITS IDs for various nights", () => {
    for (const night of [1, 3, 5, 7, 9, 11]) {
      const pool = getShopPool(night);
      for (const id of pool) {
        expect(id in UNITS, `getShopPool(${night}) returned "${id}" not in UNITS`).toBe(true);
      }
    }
  });

  it("getItemPool returns valid ITEMS IDs", () => {
    const pool = getItemPool();
    for (const id of pool) {
      expect(id in ITEMS, `getItemPool returned "${id}" not in ITEMS`).toBe(true);
    }
  });

  it("token ID has no death handler (tokens are structurally inert)", () => {
    expect(
      Object.hasOwn(UNIT_DEATH_HANDLERS, INERT_UNIT_ID),
      `"${INERT_UNIT_ID}" must not have a death handler`,
    ).toBe(false);
  });
});
