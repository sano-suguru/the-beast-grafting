import type {
  UnitInstance,
  BattleFrame,
  BattleResult,
  BattleAction,
  LogType,
  IconType,
  LogSegment,
  RegularUnitId,
  ChurchUnitId,
  Tier,
} from "../shared/types";
import type { Rng } from "./rng";
import { TOKEN_TIER } from "../shared/data/tiers";
import { generateUid } from "./helpers";
import { MAX_OPS } from "./constants";

export interface BattleUnit extends UnitInstance {
  atk: number;
  hp: number;
  preDeathHp: number;
  battleBaseAtk: number;
  battleBaseHp: number;
  altarBuffed?: boolean;
  avengeDeathCount: number;
  equipUses: number;
  skillUses: number;
}

export interface BattleContext {
  rng: Rng;
  pBoard: BattleUnit[];
  eBoard: BattleUnit[];
  frames: BattleFrame[];
  logCounter: number;
  pFlyCount: number;
  eFlyCount: number;
  lastBattleResult: BattleResult;
  opCount: number;
  opLimitExceeded: boolean;
}

/** BattleUnit fields are all primitives — shallow copy is safe.
 *  If nested objects are added, switch to structuredClone. */
function cloneBattleUnit(u: BattleUnit): BattleUnit {
  return { ...u };
}

export const seg = {
  u: (text: string): LogSegment => ({ kind: "unit", text }),
  e: (text: string): LogSegment => ({ kind: "effect", text }),
  s: (text: string): LogSegment => ({ kind: "stat", text }),
  hp: (text: string): LogSegment => ({ kind: "hp", text }),
};

export function pushFrame(
  ctx: BattleContext,
  logType: LogType,
  segments: LogSegment[],
  iconType: IconType,
  actions: Record<string, BattleAction> = {},
  delay?: number,
) {
  ctx.opCount++;
  if (ctx.opCount > MAX_OPS) {
    ctx.opLimitExceeded = true;
    return;
  }
  ctx.logCounter++;
  ctx.frames.push({
    pBoard: ctx.pBoard.map(cloneBattleUnit),
    eBoard: ctx.eBoard.map(cloneBattleUnit),
    log: { id: `log-${ctx.logCounter}`, type: logType, segments, icon: iconType },
    actions,
    ...(delay != null && { delay }),
  });
}

export function skillDamageActions(
  attacker: BattleUnit,
  target: BattleUnit,
  damage: number,
): Record<string, BattleAction> {
  return {
    [attacker.uid]: { type: "skill" },
    [target.uid]: { type: "damage", value: `-${damage}`, source: attacker.uid },
  };
}

export function aoeDamageActions(
  attacker: BattleUnit,
  targets: readonly BattleUnit[],
  damage: number,
): Record<string, BattleAction> {
  const actions: Record<string, BattleAction> = { [attacker.uid]: { type: "skill" } };
  for (const t of targets)
    actions[t.uid] = { type: "damage", value: `-${damage}`, source: attacker.uid };
  return actions;
}

export function aoeBuffActions(
  source: BattleUnit,
  targets: readonly BattleUnit[],
  value: string,
): Record<string, BattleAction> {
  const actions: Record<string, BattleAction> = { [source.uid]: { type: "skill" } };
  for (const t of targets) actions[t.uid] = { type: "buff", value };
  return actions;
}

export const enemyPrefix = (isPlayer: boolean): string => (isPlayer ? "" : "敵の");

export function getMult(boardArr: BattleUnit[], idx: number): number {
  return boardArr[idx + 1]?.id === "brains" ? 2 : 1;
}

export function getPuppeteerDeathMult(boardArr: BattleUnit[], deathIdx: number): number {
  const prev = boardArr[deathIdx - 1];
  return prev?.id === "puppeteer" && prev.hp > 0 ? 2 : 1;
}

export function takeDamage(unit: BattleUnit, amount: number): void {
  if (unit.hp > 0) unit.preDeathHp = unit.hp;
  unit.hp -= amount;
}

export function createToken(name: string, atk: number, hp: number, isChurch = false): BattleUnit {
  return {
    name,
    atk,
    hp,
    preDeathHp: hp,
    id: "token",
    uid: generateUid(),
    equip: null,
    level: 1,
    isChurch,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    baseAtk: atk,
    baseHp: hp,
    buffAtk: 0,
    buffHp: 0,
    tier: TOKEN_TIER,
    skillText: "",
    lore: "",
    exp: 0,
    avengeDeathCount: 0,
    skillUses: 0,
    equipUses: 0,
  };
}

export function createSummonedUnit(
  unitData: {
    id: RegularUnitId | ChurchUnitId;
    name: string;
    tier: Tier;
    skillText: string;
    lore: string;
  },
  atk: number,
  hp: number,
  isChurch = false,
): BattleUnit {
  return {
    ...unitData,
    atk,
    hp,
    preDeathHp: hp,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    baseAtk: atk,
    baseHp: hp,
    buffAtk: 0,
    buffHp: 0,
    uid: generateUid(),
    equip: null,
    level: 1,
    isChurch,
    exp: 0,
    avengeDeathCount: 0,
    skillUses: 0,
    equipUses: 0,
  };
}
