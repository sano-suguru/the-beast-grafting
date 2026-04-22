import type {
  UnitInstance,
  EquipType,
  BattleFrame,
  BattleResult,
  BattleAction,
  LogType,
  IconType,
  LogSegment,
  UnitId,
  Tier,
} from "../shared/types";
import type { Buff } from "../shared/skill-params";
import type { Rng } from "./rng";
import type { SimMetricsCollector } from "./sim/sim-types";
import { MAX_OPS } from "./constants";

export type BattleSide = "p" | "e";

export interface BattleUnit extends UnitInstance {
  atk: number;
  hp: number;
  preDeathHp: number;
  battleBaseAtk: number;
  battleBaseHp: number;
  spawnProcessed: boolean;
  avengeDeathCount: number;
  hurtCount: number;
  side: BattleSide;
  equipUses: number;
  skillUses: number;
  infectionLevel: number;
  lastDamageSource: string | null;
}

export interface AbsorbedData {
  id: UnitId;
  name: string;
  tier: Tier;
  atk: number;
  hp: number;
  isChurch: boolean;
  equip: EquipType | null;
}

export interface BattleContext {
  rng: Rng;
  pBoard: BattleUnit[];
  eBoard: BattleUnit[];
  frames: BattleFrame[];
  logCounter: number;

  lastBattleResult: BattleResult;
  opCount: number;
  opLimitExceeded: boolean;
  absorbedUnits: Map<string, AbsorbedData>;
  simMode: boolean;
  simCollector: SimMetricsCollector | null;

  // 今ターンに各側で計上された「被弾ユニット数」。死亡で盤面から除去されたユニットも含める。
  // Wolverine が読み取り、使用後にその側のみリセットする。
  pHurtThisTick: number;
  eHurtThisTick: number;
}

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
  segments: () => LogSegment[],
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
  if (ctx.simMode) {
    if (ctx.simCollector) {
      registerSimSummons(ctx.simCollector, actions, ctx.pBoard, ctx.eBoard);
      ctx.simCollector.frameActions.push(actions);
    }
    return;
  }
  ctx.frames.push({
    pBoard: ctx.pBoard.map(cloneBattleUnit),
    eBoard: ctx.eBoard.map(cloneBattleUnit),
    log: { id: `log-${ctx.logCounter}`, type: logType, segments: segments(), icon: iconType },
    actions,
    ...(delay != null && { delay }),
  });
}

function registerSimSummons(
  collector: SimMetricsCollector,
  actions: Record<string, BattleAction>,
  pBoard: readonly BattleUnit[],
  eBoard: readonly BattleUnit[],
) {
  for (const [uid, action] of Object.entries(actions)) {
    if (action.type !== "summon") continue;
    let side: "player" | "enemy" | null = null;
    if (pBoard.some((u) => u.uid === uid)) side = "player";
    else if (eBoard.some((u) => u.uid === uid)) side = "enemy";
    if (side) collector.unitRegistry.set(uid, { id: "token", side });
  }
}

export function skillAction(): BattleAction {
  return { type: "skill" };
}

export function clashAction(): BattleAction {
  return { type: "clash" };
}

export function defendAction(value?: string): BattleAction {
  return { type: "defend", ...(value !== undefined && { value }) };
}

export function deathAction(killer?: string): BattleAction {
  return { type: "death", ...(killer !== undefined && { killer }) };
}

export function summonAction(spawnedBy?: string): BattleAction {
  return { type: "summon", ...(spawnedBy !== undefined && { spawnedBy }) };
}

export function buffAction(buff: Buff, source?: string): BattleAction {
  return {
    type: "buff",
    value: `+${buff.atk}/+${buff.hp}`,
    buff,
    ...(source !== undefined && { source }),
  };
}

export type ClashActionType = "damage" | "defend";

export function damageAction(
  damage: number,
  source?: string,
  actionType: ClashActionType = "damage",
): BattleAction {
  return { type: actionType, value: `-${damage}`, damage, ...(source !== undefined && { source }) };
}

export function skillDamageActions(
  attacker: BattleUnit,
  target: BattleUnit,
  damage: number,
): Record<string, BattleAction> {
  return {
    [attacker.uid]: { type: "skill" },
    [target.uid]: damageAction(damage, attacker.uid),
  };
}

export function aoeDamageActions(
  attacker: BattleUnit,
  targets: readonly BattleUnit[],
  damage: number,
): Record<string, BattleAction> {
  const actions: Record<string, BattleAction> = { [attacker.uid]: skillAction() };
  for (const t of targets) actions[t.uid] = damageAction(damage, attacker.uid);
  return actions;
}

export function aoeBuffActions(
  source: BattleUnit,
  targets: readonly BattleUnit[],
  buff: Buff,
): Record<string, BattleAction> {
  const actions: Record<string, BattleAction> = { [source.uid]: skillAction() };
  for (const t of targets) actions[t.uid] = buffAction(buff, source.uid);
  return actions;
}

export const enemyPrefix = (isPlayer: boolean): string => (isPlayer ? "" : "敵の");

/**
 * Tiger(brains)の「直前の味方の能力が再発動する」挙動に必要な再発動レベルを返す。
 * idx の直後(前衛側から見て後ろ)に生存する brains がいれば、そのレベルを返す。
 * SAP仕様上、再発動は brains のレベルで行う(元ユニットのレベルではない)。
 */
export function getBrainsRepeatLevel(boardArr: BattleUnit[], idx: number): number | null {
  const behind = boardArr[idx + 1];
  if (!behind || behind.id !== "brains" || behind.hp <= 0) return null;
  return behind.level;
}

/**
 * 能力発動を通常1回+brains再発動(あれば)で包むヘルパー。
 * 再発動時は unit.level を一時的に brains のレベルに書き換えて fn を呼び出す。
 * fn は atLevel() 等を呼び出し時の u.level で評価する想定。
 */
export function runWithBrainsRepeat(
  u: BattleUnit,
  boardArr: BattleUnit[],
  idx: number,
  fn: () => void,
): void {
  fn();
  if (u.hp <= 0) return;
  const currentIdx = boardArr[idx] === u ? idx : boardArr.indexOf(u);
  if (currentIdx === -1) return;
  const repeatLevel = getBrainsRepeatLevel(boardArr, currentIdx);
  if (repeatLevel === null) return;
  const origLevel = u.level;
  u.level = repeatLevel;
  fn();
  u.level = origLevel;
}

export function removeHp(unit: BattleUnit, amount: number): number {
  const before = unit.hp;
  const after = Math.max(1, before - amount);
  unit.hp = after;
  return before - after;
}

export function takeDamage(
  unit: BattleUnit,
  amount: number,
  ctx: BattleContext,
  source?: string,
): void {
  if (unit.hp > 0) {
    unit.preDeathHp = unit.hp;
    if (amount > 0) {
      if (unit.side === "p") ctx.pHurtThisTick += 1;
      else ctx.eHurtThisTick += 1;
    }
  }
  unit.hp -= amount;
  if (source) unit.lastDamageSource = source;
}

export function createBattleContext(
  pBoard: BattleUnit[],
  eBoard: BattleUnit[],
  lastBattleResult: BattleResult,
  rng: Rng,
): BattleContext {
  return {
    rng,
    pBoard,
    eBoard,
    frames: [],
    logCounter: 0,

    lastBattleResult,
    opCount: 0,
    opLimitExceeded: false,
    absorbedUnits: new Map(),
    simMode: false,
    simCollector: null,
    pHurtThisTick: 0,
    eHurtThisTick: 0,
  };
}

export function buffAllAlive(board: BattleUnit[], buff: Buff): BattleUnit[] {
  const buffed: BattleUnit[] = [];
  for (const u of board) {
    if (u.hp <= 0) continue;
    u.atk += buff.atk;
    u.hp += buff.hp;
    buffed.push(u);
  }
  return buffed;
}
