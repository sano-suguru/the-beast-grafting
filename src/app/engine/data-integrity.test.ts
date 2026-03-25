import { UNITS } from "../data/units";
import { CHURCH_UNITS } from "../data/church-units";
import { ITEMS } from "../data/items";
import { ORIGINS } from "../data/origins";
import { UNIT_DEATH_HANDLERS } from "./battle-deaths-handlers";
import { getUnitsByTier, getShopPool, getItemPool } from "./helpers";

// --- UNITS ---

describe("UNITS data integrity", () => {
  const entries = Object.entries(UNITS);

  it("contains exactly 21 units", () => {
    expect(entries).toHaveLength(21);
  });

  it("every unit's id matches its record key", () => {
    for (const [key, data] of entries) {
      expect(data.id).toBe(key);
    }
  });

  it("every unit has positive baseAtk and baseHp", () => {
    for (const [key, data] of entries) {
      expect(data.baseAtk, `${key}.baseAtk`).toBeGreaterThan(0);
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

  it("tier distribution is 5/3/3/3/3/4 (tier 1-6, total 21)", () => {
    const counts: Record<number, number> = {};
    for (const [, data] of entries) counts[data.tier] = (counts[data.tier] ?? 0) + 1;
    expect(counts).toEqual({ 1: 5, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4 });
  });

  it("no duplicate names across units", () => {
    const names = entries.map(([, d]) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// --- CHURCH_UNITS ---

describe("CHURCH_UNITS data integrity", () => {
  const entries = Object.entries(CHURCH_UNITS);

  it("contains exactly 6 units", () => {
    expect(entries).toHaveLength(6);
  });

  it("every church unit has tier 1 or 2", () => {
    for (const [key, data] of entries) {
      expect(data.tier, `${key}.tier`).toBeGreaterThanOrEqual(1);
      expect(data.tier, `${key}.tier`).toBeLessThanOrEqual(2);
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

// --- ITEMS ---

describe("ITEMS data integrity", () => {
  const entries = Object.entries(ITEMS);

  it("contains exactly 9 items", () => {
    expect(entries).toHaveLength(9);
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

  const VALID_EQUIPS = new Set([
    "iron",
    "berserk",
    "corpse_wax",
    "infection",
    "maggot_nest",
    "numbness",
    "acid",
    "death_curse",
    null,
  ]);

  it("every item's equip is a valid EquipType or null", () => {
    for (const [key, data] of entries) {
      expect(VALID_EQUIPS.has(data.equip), `${key}.equip="${data.equip}" is invalid`).toBe(true);
    }
  });

  it("pure_blood has cost 0 (free item)", () => {
    expect(ITEMS["pure_blood"]!.cost).toBe(0);
  });
});

// --- ORIGINS ---

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

// --- Cross-references ---

describe("Cross-reference integrity", () => {
  it("every unit ID in UNIT_DEATH_HANDLERS exists in UNITS or CHURCH_UNITS", () => {
    for (const key of Object.keys(UNIT_DEATH_HANDLERS)) {
      const exists = key in UNITS || key in CHURCH_UNITS;
      expect(exists, `handler for "${key}" but unit not found`).toBe(true);
    }
  });

  it("getUnitsByTier returns valid UNITS IDs for each tier", () => {
    for (let tier = 1; tier <= 6; tier++) {
      const ids = getUnitsByTier(tier);
      expect(ids.length, `tier ${tier} should have units`).toBeGreaterThan(0);
      for (const id of ids) {
        expect(id in UNITS, `getUnitsByTier(${tier}) returned "${id}" not in UNITS`).toBe(true);
      }
    }
  });

  it("getShopPool returns valid UNITS IDs for various rounds", () => {
    for (const round of [1, 3, 5, 7, 9, 11]) {
      const pool = getShopPool(round);
      for (const id of pool) {
        expect(id in UNITS, `getShopPool(${round}) returned "${id}" not in UNITS`).toBe(true);
      }
    }
  });

  it("getItemPool returns valid ITEMS IDs", () => {
    const pool = getItemPool();
    for (const id of pool) {
      expect(id in ITEMS, `getItemPool returned "${id}" not in ITEMS`).toBe(true);
    }
  });
});
