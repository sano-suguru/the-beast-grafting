import { createUnit, getShopPool, getItemPool, getEquipInfo, generateEnemyTeam } from "./helpers";
import { EQUIPS } from "../shared/data/equips";
import type { EquipType } from "../shared/types";
import { createSeededRng } from "./rng";

describe("createUnit", () => {
  it("creates a unit from UNITS registry", () => {
    const unit = createUnit("rat");
    expect(unit.id).toBe("rat");
    expect(unit.name).toBe("疫病ネズミ");
    expect(unit.atk).toBe(2);
    expect(unit.hp).toBe(2);
    expect(unit.level).toBe(1);
    expect(unit.exp).toBe(0);
    expect(unit.equip).toBeNull();
    expect(unit.isChurch).toBe(false);
  });

  it("creates a church unit from CHURCH_UNITS registry", () => {
    const unit = createUnit("squire");
    expect(unit.id).toBe("squire");
    expect(unit.name).toBe("見習い従騎士");
    expect(unit.isChurch).toBe(true);
  });

  it("sets atk/hp from baseAtk/baseHp", () => {
    const unit = createUnit("beast");
    expect(unit.atk).toBe(unit.baseAtk);
    expect(unit.hp).toBe(unit.baseHp);
  });

  it("generates a uid string", () => {
    const unit = createUnit("rat");
    expect(typeof unit.uid).toBe("string");
    expect(unit.uid.length).toBeGreaterThan(0);
  });
});

describe("getShopPool", () => {
  it("returns Tier 1 units for round 1-2", () => {
    const pool = getShopPool(1);
    expect(pool).toEqual(["rat", "beggar", "hound", "bat", "zealot"]);
  });

  it("adds Tier 2 units at round 3", () => {
    const pool = getShopPool(3);
    expect(pool).toContain("martyr");
    expect(pool).toContain("beast");
    expect(pool).toContain("cholera");
  });

  it("adds Tier 3 units at round 5", () => {
    const pool = getShopPool(5);
    expect(pool).toContain("parasite");
    expect(pool).toContain("maiden");
    expect(pool).toContain("revenant");
  });

  it("adds Tier 4 units at round 7", () => {
    const pool = getShopPool(7);
    expect(pool).toContain("evangelist");
    expect(pool).toContain("altar");
    expect(pool).toContain("machine");
  });

  it("adds Tier 5 units at round 9", () => {
    const pool = getShopPool(9);
    expect(pool).toContain("shrieking_throat");
    expect(pool).toContain("hundred_arms");
    expect(pool).toContain("chalice");
  });

  it("adds Tier 6 units at round 11", () => {
    const pool = getShopPool(11);
    expect(pool).toContain("brains");
    expect(pool).toContain("eye");
    expect(pool).toContain("beelzebub");
    expect(pool).toContain("rot_ring");
    expect(pool).toHaveLength(5 + 3 + 3 + 3 + 3 + 4);
  });

  it("is deterministic for the same round", () => {
    expect(getShopPool(5)).toEqual(getShopPool(5));
  });
});

describe("getItemPool", () => {
  it("returns all item ids", () => {
    const pool = getItemPool();
    expect(pool).toEqual([
      "preservative",
      "iron_plate",
      "bile",
      "maggot",
      "corpse_wax",
      "numbness",
      "acid_blood",
      "death_curse",
    ]);
  });

  it("does not include pure_blood", () => {
    expect(getItemPool()).not.toContain("pure_blood");
  });
});

describe("getEquipInfo", () => {
  it("returns info for iron", () => {
    expect(getEquipInfo("iron").name).toBe("縫合された鉄板");
  });

  it("returns info for all valid equip ids", () => {
    const equipIds = Object.keys(EQUIPS) as EquipType[];
    for (const id of equipIds) {
      const info = getEquipInfo(id);
      expect(info.name).toBeTruthy();
      expect(info.desc).toBeTruthy();
    }
  });
});

describe("generateEnemyTeam", () => {
  it("produces deterministic teams with same seeded RNG", () => {
    const team1 = generateEnemyTeam(5, createSeededRng(42));
    const team2 = generateEnemyTeam(5, createSeededRng(42));
    expect(team1.teamType).toBe(team2.teamType);
    expect(team1.teamName).toBe(team2.teamName);
    expect(team1.units.length).toBe(team2.units.length);
    team1.units.forEach((u, i) => {
      expect(u.id).toBe(team2.units[i]!.id);
    });
  });

  it("produces different teams with different seeds", () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const team = generateEnemyTeam(5, createSeededRng(seed));
      results.add(team.teamName);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
