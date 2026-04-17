import type { BattleUnit, BattleContext } from "./battle-context";
import { createBattleContext } from "./battle-context";
import { getDeathHandler } from "./battle-deaths-handlers";
import type { DeathHandlerUnitId } from "./battle-deaths-handlers";
import { invariant } from "../shared/invariant";
import type {
  UnitInstance,
  BattleUnitSnapshot,
  EnemyTeam,
  BattleResult,
  LogSegment,
} from "../shared/types";
import type { Rng } from "./rng";
import { createSeededRng } from "./rng";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";

export function segmentsToPlainText(segments: LogSegment[]): string {
  return segments.map((s) => (typeof s === "string" ? s : s.text)).join("");
}

/** トークンはハンドラ登録が構造的に不可能なため、副作用なしのテスト用IDとして使える */
export const INERT_UNIT_ID = "token" as const;

export function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    id: "rat",
    name: "疫病ネズミ",
    baseAtk: 2,
    baseHp: 1,
    buffAtk: 0,
    buffHp: 0,
    tempBuffAtk: 0,
    tier: 1,
    skillText: "",
    lore: "",
    level: 1,
    exp: 0,
    equip: null,
    uid: `test-${Math.random().toString(36).slice(2, 8)}`,
    isChurch: false,
    ...overrides,
  };
}

export function makeBattleUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  const unit = makeUnit(overrides);
  const atk = effectiveAtk(unit);
  const hp = effectiveHp(unit);
  return {
    ...unit,
    atk,
    hp,
    preDeathHp: overrides.preDeathHp ?? hp,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    avengeDeathCount: 0,
    skillUses: 0,
    equipUses: 0,
    infectionLevel: 0,
    ...overrides,
    altarBuffed: overrides.altarBuffed ?? false,
    lastDamageSource: overrides.lastDamageSource ?? null,
  };
}

export function makeContext(
  pBoard: BattleUnit[] = [],
  eBoard: BattleUnit[] = [],
  lastBattleResult: BattleResult = null,
  rng: Rng = createSeededRng(42),
): BattleContext {
  return createBattleContext(pBoard, eBoard, lastBattleResult, rng);
}

export function makeSnapshot(overrides: Partial<BattleUnitSnapshot> = {}): BattleUnitSnapshot {
  const unit = makeUnit(overrides as Partial<UnitInstance>);
  const atk = effectiveAtk(unit);
  const hp = effectiveHp(unit);
  return {
    ...unit,
    atk,
    hp,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    ...overrides,
  };
}

export function callDeathHandler(
  id: DeathHandlerUnitId,
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
  successor: BattleUnit | null = idx < board.length ? (board[idx] ?? null) : null,
  successor2: BattleUnit | null = idx + 1 < board.length ? (board[idx + 1] ?? null) : null,
) {
  const handler = getDeathHandler(id);
  invariant(handler, `no death handler for "${id}"`);
  handler({ dead, board, idx, isPlayer, ctx, successor, successor2 });
}

export function makeEnemyTeam(units: UnitInstance[]): EnemyTeam {
  return {
    teamName: "[同業者] テスト敵チーム",
    teamType: "同業者",
    units,
    night: null,
    life: null,
    trophy: null,
  };
}
