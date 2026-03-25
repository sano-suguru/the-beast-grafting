import type { BattleUnit, BattleContext } from "./battle-context";
import type { UnitInstance, EnemyTeam, BattleResult } from "../types";
import type { Rng } from "./rng";

export function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    id: "rat",
    name: "疫病ネズミ",
    baseAtk: 2,
    baseHp: 1,
    tier: 1,
    skillText: "",
    lore: "",
    atk: 2,
    hp: 1,
    level: 1,
    exp: 0,
    equip: null,
    uid: `test-${Math.random().toString(36).slice(2, 8)}`,
    isChurch: false,
    ...overrides,
  };
}

export function makeBattleUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return { ...makeUnit(overrides), skillUses: 0, equipUses: 0, ...overrides };
}

export function makeContext(
  pBoard: BattleUnit[] = [],
  eBoard: BattleUnit[] = [],
  lastBattleResult: BattleResult = null,
  rng: Rng = { next: () => Math.random() },
): BattleContext {
  return {
    rng,
    pBoard,
    eBoard,
    frames: [],
    logCounter: 0,
    pFlyCount: 0,
    eFlyCount: 0,
    lastBattleResult,
    opCount: 0,
    opLimitExceeded: false,
  };
}

export function makeEnemyTeam(units: UnitInstance[]): EnemyTeam {
  return {
    teamName: "[同業者] テスト敵チーム",
    teamType: "同業者",
    units,
  };
}
