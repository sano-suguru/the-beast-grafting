import type { UnitInstance, EnemyTeam, BattleFrame, BattleResult } from "../shared/types";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { generateUid } from "./helpers";
import type { BattleContext, BattleUnit } from "./battle-context";
import { pushFrame, seg } from "./battle-context";
import type { Rng } from "./rng";
import { createSeededRng } from "./rng";
import { resolveDeaths } from "./battle-deaths";
import {
  runStartSkills,
  applyBeforeAttackSkills,
  applyCholeraBeforeAttack,
  applyOnHitSkills,
  applyEquipmentEffects,
} from "./battle-skills";
import { applyAcidSplash, processHundredArmsKnockout } from "./battle-skills-combat";
import { COMBAT_ROUND_LIMIT, NUMBNESS_INITIAL_USES } from "./constants";
import { atLevel, CHOLERA, EYE } from "../shared/skill-params";

function initBattleUnit(u: UnitInstance): BattleUnit {
  const atk = effectiveAtk(u);
  const hp = effectiveHp(u);
  const bu: BattleUnit = {
    ...u,
    atk,
    hp,
    battleBaseAtk: atk,
    battleBaseHp: hp,
    buffAtk: 0,
    buffHp: 0,
    uid: generateUid(),
    skillUses: 0,
    equipUses: 0,
  };
  if (bu.id === "cholera") bu.skillUses = atLevel(CHOLERA.uses, bu.level);
  if (bu.id === "eye") bu.skillUses = atLevel(EYE.uses, bu.level);
  if (bu.equip === "numbness") bu.equipUses = NUMBNESS_INITIAL_USES;
  return bu;
}

function initContext(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  lastBattleResult: BattleResult,
  rng: Rng,
): BattleContext {
  return {
    rng,
    pBoard: playerBoard
      .filter((u): u is UnitInstance => u !== null)
      .reverse()
      .map(initBattleUnit),
    eBoard: enemyTeam.units.toReversed().map(initBattleUnit),
    frames: [],
    logCounter: 0,
    pFlyCount: 0,
    eFlyCount: 0,
    lastBattleResult,
    opCount: 0,
    opLimitExceeded: false,
  };
}

function runCombatRound(ctx: BattleContext) {
  applyCholeraBeforeAttack(ctx.pBoard, ctx.eBoard, true, ctx);
  applyCholeraBeforeAttack(ctx.eBoard, ctx.pBoard, false, ctx);

  applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
  applyBeforeAttackSkills(ctx.eBoard, ctx.pBoard, false, ctx);

  const p = ctx.pBoard[0];
  const e = ctx.eBoard[0];
  if (!p || !e) return;

  pushFrame(ctx, "clash", [seg.u(p.name), " と 敵の", seg.u(e.name), " が喰らい合う！"], "clash", {
    [p.uid]: { type: "clash" },
    [e.uid]: { type: "clash" },
  });

  const { pDmg, eDmg, pAction, eAction } = applyEquipmentEffects(p, e, ctx);
  const pHpBefore = p.hp;
  const eHpBefore = e.hp;
  p.hp -= pDmg;
  e.hp -= eDmg;

  pushFrame(
    ctx,
    "damage",
    [
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
      [p.uid]: { type: pAction, value: `-${pDmg}`, source: e.uid },
      [e.uid]: { type: eAction, value: `-${eDmg}`, source: p.uid },
    },
  );

  applyOnHitSkills(p, ctx.pBoard, true, ctx);
  applyOnHitSkills(e, ctx.eBoard, false, ctx);

  applyAcidSplash(p, ctx.eBoard, true, ctx);
  applyAcidSplash(e, ctx.pBoard, false, ctx);

  const pKilledE = e.hp <= 0;
  const eKilledP = p.hp <= 0;

  resolveDeaths(ctx);

  // Hundred-Arms knockout: triggers after deaths are resolved
  if (pKilledE) processHundredArmsKnockout(p, ctx.eBoard, ctx.pBoard, true, ctx);
  if (eKilledP) processHundredArmsKnockout(e, ctx.pBoard, ctx.eBoard, false, ctx);
}

function determineResult(ctx: BattleContext, timedOut: boolean): BattleResult {
  if (timedOut) return "DRAW";
  if (ctx.pBoard.length > 0) return "WIN";
  if (ctx.eBoard.length > 0) return "LOSE";
  return "DRAW";
}

function pushResultFrame(ctx: BattleContext, result: BattleResult, enemyTeam: EnemyTeam) {
  if (result === "WIN") {
    pushFrame(ctx, "result", ["勝利。死体の山から、あなたの傑作が嗤っている。"], "trophy");
  } else if (result === "LOSE") {
    const msg =
      enemyTeam.teamType === "教団"
        ? "敗北。あなたの傑作は異端審問官の炎に巻かれ、灰も残さず焼き尽くされた。"
        : "敗北。あなたの傑作は無残に解体され、同業者のキメラに貪り喰われた。";
    pushFrame(ctx, "result", [msg], "skull");
  } else {
    pushFrame(ctx, "result", ["引き分け。路地裏には静寂と腐臭だけが残った。"], "info");
  }
}

/** @internal テスト専用 — simulateBattle を介さず BattleContext を直接制御するテスト向け */
export function runBattle(
  ctx: BattleContext,
  enemyTeam: EnemyTeam,
  round: number,
): { frames: BattleFrame[]; result: BattleResult } {
  pushFrame(
    ctx,
    "info",
    [seg.e(`第${round}夜`), ` 狂宴が幕を開けた。敵は ${enemyTeam.teamName} だ。`],
    "info",
  );

  runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
  runStartSkills(ctx.eBoard, ctx.pBoard, false, ctx);

  let loopSafety = 0;
  while (
    ctx.pBoard.length > 0 &&
    ctx.eBoard.length > 0 &&
    loopSafety < COMBAT_ROUND_LIMIT &&
    !ctx.opLimitExceeded
  ) {
    loopSafety++;
    runCombatRound(ctx);
  }

  const timedOut = loopSafety >= COMBAT_ROUND_LIMIT || ctx.opLimitExceeded;
  if (timedOut) {
    pushFrame(ctx, "info", ["戦闘が長引きすぎた...引き分けとなる。"], "info");
  }

  const result = determineResult(ctx, timedOut);
  pushResultFrame(ctx, result, enemyTeam);

  return { frames: ctx.frames, result };
}

export function simulateBattle(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  round: number,
  seed: number,
  lastBattleResult: BattleResult = null,
): { frames: BattleFrame[]; result: BattleResult } {
  const rng = createSeededRng(seed);
  const ctx = initContext(playerBoard, enemyTeam, lastBattleResult, rng);
  return runBattle(ctx, enemyTeam, round);
}
