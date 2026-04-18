import type { LogSegment, DataUnitId, Tier } from "../shared/types";
import type { UnitData } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, enemyPrefix, seg, summonAction } from "./battle-context";
import { applyZealotBuff } from "./battle-deaths-zealot";
import { getInitOverride } from "./battle-init-overrides";
import { generateUid } from "./helpers";
import { TOKEN_TIER } from "../shared/data/tiers";
import { MAX_BOARD_SIZE } from "./constants";

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

function createSummonedUnit(
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

type SpawnBase = {
  board: BattleUnit[];
  idx: number;
  atk: number;
  hp: number;
  isChurch: boolean;
  level?: number | undefined;
  segments: () => LogSegment[];
  isPlayer: boolean;
  ctx: BattleContext;
  delay?: number | undefined;
  spawnerUid?: string | undefined;
};

function notifyBoardFull(ctx: BattleContext, name: string, isPlayer: boolean): void {
  pushFrame(
    ctx,
    "info",
    () => [enemyPrefix(isPlayer), seg.u(name), "が蠢くが、肉の壁に阻まれる。"],
    "info",
  );
}

function finalize(s: SpawnBase, unit: BattleUnit): BattleUnit {
  s.board.splice(s.idx, 0, unit);
  pushFrame(
    s.ctx,
    "skill",
    s.segments,
    "skill",
    { [unit.uid]: summonAction(s.spawnerUid) },
    s.delay,
  );
  applyZealotBuff(s.board, unit.uid, s.isPlayer, s.ctx);
  return unit;
}

export function spawnTokenAndNotify(s: SpawnBase & { name: string }): BattleUnit | null {
  if (s.board.length >= MAX_BOARD_SIZE) {
    notifyBoardFull(s.ctx, s.name, s.isPlayer);
    return null;
  }
  return finalize(s, createToken(s.name, s.atk, s.hp, s.isChurch));
}

export function spawnSummonedUnitAndNotify(
  s: SpawnBase & { unitData: UnitData },
): BattleUnit | null {
  if (s.board.length >= MAX_BOARD_SIZE) {
    notifyBoardFull(s.ctx, s.unitData.name, s.isPlayer);
    return null;
  }
  const unit = createSummonedUnit(s.unitData, s.atk, s.hp, s.isChurch, s.level);
  getInitOverride(unit.id)?.(unit);
  return finalize(s, unit);
}
