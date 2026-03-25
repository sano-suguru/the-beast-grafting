import type {
  UnitInstance,
  BattleFrame,
  BattleResult,
  BattleAction,
  LogType,
  IconType,
} from "../types";
import type { Rng } from "./rng";
import { generateUid } from "./helpers";
import { MAX_OPS } from "./constants";

export interface BattleUnit extends UnitInstance {
  altarBuffed?: boolean;
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

export function pushFrame(
  ctx: BattleContext,
  logType: LogType,
  logText: string,
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
    log: { id: `log-${ctx.logCounter}`, type: logType, text: logText, icon: iconType },
    actions,
    ...(delay != null && { delay }),
  });
}

export const enemyPrefix = (isPlayer: boolean): string => (isPlayer ? "" : "敵の");

export function getMult(boardArr: BattleUnit[], idx: number): number {
  return boardArr[idx + 1]?.id === "brains" ? 2 : 1;
}

export function createToken(name: string, atk: number, hp: number, isChurch = false): BattleUnit {
  return {
    name,
    atk,
    hp,
    id: "token",
    uid: generateUid(),
    equip: null,
    level: 1,
    isChurch,
    baseAtk: atk,
    baseHp: hp,
    tier: 0,
    skillText: "",
    lore: "",
    exp: 0,
    skillUses: 0,
    equipUses: 0,
  };
}

export function createSummonedUnit(
  unitData: { id: string; name: string; tier: number; skillText: string; lore: string },
  atk: number,
  hp: number,
  isChurch = false,
): BattleUnit {
  return {
    ...unitData,
    atk,
    hp,
    baseAtk: atk,
    baseHp: hp,
    uid: generateUid(),
    equip: null,
    level: 1,
    isChurch,
    exp: 0,
    skillUses: 0,
    equipUses: 0,
  };
}
