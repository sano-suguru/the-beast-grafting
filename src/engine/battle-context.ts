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
  DataUnitId,
  Tier,
} from "../shared/types";
import type { Buff } from "../shared/skill-params";
import type { Rng } from "./rng";
import type { SimMetricsCollector } from "./sim/sim-types";
import { TOKEN_TIER } from "../shared/data/tiers";
import { generateUid } from "./helpers";
import { MAX_OPS } from "./constants";

export interface BattleUnit extends UnitInstance {
  atk: number;
  hp: number;
  preDeathHp: number;
  battleBaseAtk: number;
  battleBaseHp: number;
  altarBuffed: boolean;
  avengeDeathCount: number;
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

export function healAction(hp: number, source?: string): BattleAction {
  return {
    type: "heal",
    value: `+0/+${hp}`,
    heal: hp,
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

export function getMult(boardArr: BattleUnit[], idx: number): number {
  return boardArr[idx + 1]?.id === "brains" ? 2 : 1;
}

export function getPuppeteerDeathMult(boardArr: BattleUnit[], deathIdx: number): number {
  const prev = boardArr[deathIdx - 1];
  return prev?.id === "puppeteer" && prev.hp > 0 ? 2 : 1;
}

export function takeDamage(unit: BattleUnit, amount: number, source?: string): void {
  if (unit.hp > 0) unit.preDeathHp = unit.hp;
  unit.hp -= amount;
  if (source) unit.lastDamageSource = source;
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
    altarBuffed: false,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    baseAtk: atk,
    baseHp: hp,
    buffAtk: 0,
    buffHp: 0,
    tempBuffAtk: 0,
    tier: TOKEN_TIER,
    skillText: "",
    lore: "",
    exp: 0,
    avengeDeathCount: 0,
    skillUses: 0,
    equipUses: 0,
    infectionLevel: 0,
    lastDamageSource: null,
  };
}

export function createSummonedUnit(
  unitData: {
    id: DataUnitId;
    name: string;
    tier: Tier;
    skillText: string;
    lore: string;
  },
  atk: number,
  hp: number,
  isChurch = false,
  level = 1,
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
    tempBuffAtk: 0,
    uid: generateUid(),
    equip: null,
    level,
    isChurch,
    altarBuffed: false,
    exp: 0,
    avengeDeathCount: 0,
    skillUses: 0,
    equipUses: 0,
    infectionLevel: 0,
    lastDamageSource: null,
  };
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
  };
}

export function notifyEquipInfection(
  ctx: BattleContext,
  prefix: string,
  target: BattleUnit,
  delay?: number,
) {
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(target.name), "の装備が疫病に蝕まれた！"],
    "skill",
    { [target.uid]: { type: "damage", value: "装備消去" } },
    delay,
  );
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
