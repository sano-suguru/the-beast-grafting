import type { UnitInstance, EnemyTeam, BattleFrame, BattleResult } from "../shared/types";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { generateUid } from "./helpers";
import type { BattleContext, BattleUnit } from "./battle-context";
import {
  createBattleContext,
  pushFrame,
  takeDamage,
  skillDamageActions,
  damageAction,
  clashAction,
  enemyPrefix,
  seg,
} from "./battle-context";
import type { Rng } from "./rng";
import { createSeededRng } from "./rng";
import { resolveDeaths } from "./battle-deaths";
import {
  runStartSkills,
  applyBeforeAttackSkills,
  applyOnHitSkills,
  applyEquipmentEffects,
  applyAfterAttackSkills,
} from "./battle-skills";
import { applyAcidSplash, processKnockoutEffects } from "./battle-skills-combat";
import { CLASH_LIMIT, NUMBNESS_INITIAL_USES } from "./constants";
import { getInitOverride } from "./battle-init-overrides";

function initBattleUnit(u: UnitInstance): BattleUnit {
  const atk = effectiveAtk(u);
  const hp = effectiveHp(u);
  const bu: BattleUnit = {
    ...u,
    atk,
    hp,
    preDeathHp: hp,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    buffAtk: 0,
    buffHp: 0,
    tempBuffAtk: 0,
    uid: generateUid(),
    spawnProcessed: false,
    avengeDeathCount: 0,
    skillUses: 0,
    equipUses: 0,
    infectionLevel: 0,
    lastDamageSource: null,
  };
  getInitOverride(bu.id)?.(bu);
  if (bu.equip === "numbness") bu.equipUses = NUMBNESS_INITIAL_USES;
  return bu;
}

export function initBattleContext(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  lastBattleResult: BattleResult,
  rng: Rng,
): BattleContext {
  // 全レイヤーで index 0 = 前衛, index N-1 = 後衛 の規約に統一されている
  return createBattleContext(
    playerBoard.filter((u): u is UnitInstance => u !== null).map(initBattleUnit),
    enemyTeam.units.map(initBattleUnit),
    lastBattleResult,
    rng,
  );
}

function resolveNecroticInstantKill(
  attacker: BattleUnit,
  target: BattleUnit,
  waxBlocked: boolean,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (attacker.id !== "necrotic_finger" || target.hp <= 0 || waxBlocked) return;
  const hpBefore = target.hp;
  takeDamage(target, hpBefore, attacker.uid);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(attacker.name),
      "が触れた先から",
      seg.u(target.name),
      "が朽ちる。",
      seg.hp(`${hpBefore}→0`),
    ],
    "skill",
    skillDamageActions(attacker, target, hpBefore),
  );
}

function resolveClashDamage(
  p: BattleUnit,
  e: BattleUnit,
  ctx: BattleContext,
): { pWaxBlocked: boolean; eWaxBlocked: boolean } {
  pushFrame(
    ctx,
    "clash",
    () => [seg.u(p.name), " と 敵の", seg.u(e.name), " が喰らい合う！"],
    "clash",
    { [p.uid]: clashAction(), [e.uid]: clashAction() },
  );
  const { pDmg, eDmg, pAction, eAction, pWaxBlocked, eWaxBlocked } = applyEquipmentEffects(
    p,
    e,
    ctx,
  );
  const pHpBefore = p.hp;
  const eHpBefore = e.hp;
  takeDamage(p, pDmg, e.uid);
  takeDamage(e, eDmg, p.uid);
  pushFrame(
    ctx,
    "damage",
    () => [
      "互いの肉が裂ける！ ",
      seg.u(p.name),
      " ",
      seg.hp(`${pHpBefore}→${Math.max(0, p.hp)}`),
      " / 敵の",
      seg.u(e.name),
      " ",
      seg.hp(`${eHpBefore}→${Math.max(0, e.hp)}`),
    ],
    "damage",
    {
      [p.uid]: damageAction(pDmg, e.uid, pAction),
      [e.uid]: damageAction(eDmg, p.uid, eAction),
    },
  );
  return { pWaxBlocked, eWaxBlocked };
}

function resolveClash(
  p: BattleUnit,
  e: BattleUnit,
  ctx: BattleContext,
): { pKilledE: boolean; eKilledP: boolean } {
  const { pWaxBlocked, eWaxBlocked } = resolveClashDamage(p, e, ctx);
  resolveNecroticInstantKill(p, e, eWaxBlocked, true, ctx);
  resolveNecroticInstantKill(e, p, pWaxBlocked, false, ctx);
  applyOnHitSkills(p, ctx.pBoard, true, ctx);
  applyOnHitSkills(e, ctx.eBoard, false, ctx);
  applyAfterAttackSkills(p, ctx.pBoard, ctx.eBoard, true, ctx);
  applyAfterAttackSkills(e, ctx.eBoard, ctx.pBoard, false, ctx);
  // on-hitキルを酸散布前に確定させ、死亡ユニットが酸の対象にならないようにする
  resolveDeaths(ctx);
  applyAcidSplash(p, ctx.eBoard, true, ctx);
  applyAcidSplash(e, ctx.pBoard, false, ctx);
  return { pKilledE: e.hp <= 0, eKilledP: p.hp <= 0 };
}

function runClash(ctx: BattleContext) {
  applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
  applyBeforeAttackSkills(ctx.eBoard, ctx.pBoard, false, ctx);

  const p = ctx.pBoard[0];
  const e = ctx.eBoard[0];
  if (!p || !e) return;

  const { pKilledE, eKilledP } = resolveClash(p, e, ctx);

  resolveDeaths(ctx);

  if (pKilledE) processKnockoutEffects(p, ctx.eBoard, ctx.pBoard, true, ctx);
  if (eKilledP) processKnockoutEffects(e, ctx.pBoard, ctx.eBoard, false, ctx);
}

function determineResult(ctx: BattleContext, timedOut: boolean): BattleResult {
  if (timedOut) {
    const pHp = ctx.pBoard.reduce((sum, u) => sum + Math.max(0, u.hp), 0);
    const eHp = ctx.eBoard.reduce((sum, u) => sum + Math.max(0, u.hp), 0);
    if (pHp > eHp) return "WIN";
    if (eHp > pHp) return "LOSE";
    return "DRAW";
  }
  if (ctx.pBoard.length > 0) return "WIN";
  if (ctx.eBoard.length > 0) return "LOSE";
  return "DRAW";
}

function pushResultFrame(ctx: BattleContext, result: BattleResult, enemyTeam: EnemyTeam) {
  if (result === "WIN") {
    pushFrame(ctx, "result", () => ["勝利。死体の山から、あなたの傑作が嗤っている。"], "trophy");
  } else if (result === "LOSE") {
    const msg =
      enemyTeam.teamType === "教団"
        ? "敗北。あなたの傑作は異端審問官の炎に巻かれ、灰も残さず焼き尽くされた。"
        : "敗北。あなたの傑作は無残に解体され、同業者のキメラに貪り喰われた。";
    pushFrame(ctx, "result", () => [msg], "skull");
  } else {
    pushFrame(ctx, "result", () => ["引き分け。路地裏には静寂と腐臭だけが残った。"], "info");
  }
}

/** @internal テスト専用 — simulateBattle を介さず BattleContext を直接制御するテスト向け */
export function runBattle(
  ctx: BattleContext,
  enemyTeam: EnemyTeam,
  night: number,
): { frames: BattleFrame[]; result: BattleResult } {
  pushFrame(
    ctx,
    "info",
    () => [seg.e(`第${night}夜`), ` 狂宴が幕を開けた。敵は ${enemyTeam.teamName} だ。`],
    "info",
  );

  runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
  runStartSkills(ctx.eBoard, ctx.pBoard, false, ctx);

  let loopSafety = 0;
  while (
    ctx.pBoard.length > 0 &&
    ctx.eBoard.length > 0 &&
    loopSafety < CLASH_LIMIT &&
    !ctx.opLimitExceeded
  ) {
    loopSafety++;
    runClash(ctx);
  }

  const timedOut = loopSafety >= CLASH_LIMIT || ctx.opLimitExceeded;
  if (timedOut) {
    pushFrame(ctx, "info", () => ["戦闘が長引きすぎた...残存する肉の量で決着がつく。"], "info");
  }

  const result = determineResult(ctx, timedOut);
  pushResultFrame(ctx, result, enemyTeam);

  return { frames: ctx.frames, result };
}

export function simulateBattle(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  night: number,
  seed: number,
  lastBattleResult: BattleResult = null,
): { frames: BattleFrame[]; result: BattleResult } {
  const rng = createSeededRng(seed);
  const ctx = initBattleContext(playerBoard, enemyTeam, lastBattleResult, rng);
  return runBattle(ctx, enemyTeam, night);
}
