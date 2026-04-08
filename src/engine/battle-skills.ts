import type { BattleAction, LogSegment, UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg, skillDamageActions } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../shared/invariant";
import { SUPPORT_IDX } from "./constants";
import {
  atLevel,
  BAT,
  INQUISITOR,
  BANSHEE,
  REVENANT,
  PARASITE,
  EYE,
  TEMPLAR,
} from "../shared/skill-params";

type SkillContext = {
  u: BattleUnit;
  targetArr: BattleUnit[];
  isPlayer: boolean;
  ctx: BattleContext;
};

type StartSkillHandler = (context: SkillContext) => void;

function applySkillDamage(
  u: BattleUnit,
  target: BattleUnit,
  dmg: number,
  segments: LogSegment[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  target.hp -= dmg;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "skill", [prefix, ...segments], "skill", {
    [u.uid]: { type: "skill" },
    [target.uid]: { type: "damage", value: `-${dmg}`, source: u.uid },
  });
  resolveDeaths(ctx);
}

function applyBatSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const dmg = atLevel(BAT.damage, u.level);
  const targetCount = Math.min(atLevel(BAT.targets, u.level), targetArr.length);
  const chosen: BattleUnit[] = [];
  const pool = [...targetArr];
  for (let i = 0; i < targetCount && pool.length > 0; i++) {
    const idx = Math.floor(ctx.rng.next() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]!);
  }
  for (const target of chosen) {
    const hpBefore = target.hp;
    applySkillDamage(
      u,
      target,
      dmg,
      [
        seg.u(u.name),
        "が喰らいつく！ ",
        seg.u(target.name),
        "に ",
        seg.hp(`${hpBefore}→${Math.max(0, hpBefore - dmg)}`),
      ],
      isPlayer,
      ctx,
    );
  }
}

function applyInquisitorSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const target = mustGet(targetArr, 0, "inquisitor target");
  const dmg = atLevel(INQUISITOR.damage, u.level);
  const hpBefore = target.hp;
  applySkillDamage(
    u,
    target,
    dmg,
    [
      seg.u(u.name),
      "が裁きを下す！ ",
      seg.u(target.name),
      "に ",
      seg.hp(`${hpBefore}→${Math.max(0, hpBefore - dmg)}`),
    ],
    isPlayer,
    ctx,
  );
}

function applyBansheeSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  const back = targetArr[targetArr.length - 1];
  if (!back) return;
  const dmg = atLevel(BANSHEE.damage, u.level);
  const hpBefore = back.hp;
  applySkillDamage(
    u,
    back,
    dmg,
    [
      seg.u(u.name),
      "が叫ぶ！ 最後尾の",
      seg.u(back.name),
      "に ",
      seg.hp(`${hpBefore}→${Math.max(0, hpBefore - dmg)}`),
    ],
    isPlayer,
    ctx,
  );
}

function applyCholeraSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const targetIdx = Math.floor(ctx.rng.next() * targetArr.length);
  const target = mustGet(targetArr, targetIdx, "cholera target");
  const prevEquip = target.equip;
  target.equip = "infection";
  const prefix = enemyPrefix(isPlayer);
  if (prevEquip && prevEquip !== "infection") {
    pushFrame(ctx, "skill", [prefix, seg.u(target.name), "の装備が疫病に蝕まれた！"], "skill", {
      [target.uid]: { type: "damage", value: "装備消去" },
    });
  }
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "が疫病を撒き散らす！ ",
      seg.u(target.name),
      "が",
      seg.e("感染"),
      "した。",
    ],
    "skill",
    {
      [u.uid]: { type: "skill" },
      [target.uid]: { type: "defend", value: "感染" },
    },
  );
}

function applyRevenantSkill({ u, isPlayer, ctx }: SkillContext) {
  if (ctx.lastBattleResult !== "LOSE") return;
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const prefix = enemyPrefix(isPlayer);
  const maxTargets = atLevel(REVENANT.targets, u.level);
  const buffAmount = atLevel(REVENANT.buff, u.level);
  const actions: Record<string, BattleAction> = {
    [u.uid]: { type: "skill" },
  };
  let buffed = 0;
  for (const ally of allyBoard) {
    if (buffed >= maxTargets) break;
    if (ally.uid === u.uid) continue;
    ally.atk += buffAmount;
    actions[ally.uid] = { type: "buff", value: `+${buffAmount}/+0` };
    buffed++;
  }
  if (buffed > 0) {
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(u.name), `の眼が血走る。前方${buffed}体の攻撃力+${buffAmount}。`],
      "skill",
      actions,
    );
  }
}

const START_SKILL_HANDLERS = {
  bat: applyBatSkill,
  inquisitor: applyInquisitorSkill,
  shrieking_throat: applyBansheeSkill,
  revenant: applyRevenantSkill,
} satisfies Partial<Record<UnitId, StartSkillHandler>>;

type StartSkillUnitId = keyof typeof START_SKILL_HANDLERS;

function getStartSkillHandler(id: UnitId): StartSkillHandler | undefined {
  return Object.hasOwn(START_SKILL_HANDLERS, id)
    ? START_SKILL_HANDLERS[id as StartSkillUnitId]
    : undefined;
}

export function runStartSkills(
  boardArr: BattleUnit[],
  targetArr: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  boardArr.forEach((u) => {
    const handler = getStartSkillHandler(u.id);
    if (!handler) return;
    handler({ u, targetArr, isPlayer, ctx });
  });
}

export function applyCholeraBeforeAttack(
  board: BattleUnit[],
  targetArr: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "cholera") continue;
    if (u.skillUses <= 0) continue;
    applyCholeraSkill({ u, targetArr, isPlayer, ctx });
    u.skillUses = 0;
  }
}

function applyParasiteBuff(u: BattleUnit, prefix: string, ctx: BattleContext) {
  const b = atLevel(PARASITE.buff, u.level);
  u.atk += b.atk;
  u.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(u.name), "が前衛の闘争に興奮する！ ", seg.s(`+${b.atk}/+${b.hp}`)],
    "skill",
    { [u.uid]: { type: "buff", value: `+${b.atk}/+${b.hp}` } },
  );
}

function applyEyeGaze(u: BattleUnit, enemyBoard: BattleUnit[], prefix: string, ctx: BattleContext) {
  if (enemyBoard.length === 0 || u.skillUses <= 0) return;
  const target = mustGet(enemyBoard, Math.floor(ctx.rng.next() * enemyBoard.length), "eye target");
  const dmg = atLevel(EYE.damage, u.level);
  const hpBefore = target.hp;
  target.hp -= dmg;
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "が",
      seg.u(target.name),
      "を睨みつける！ ",
      seg.hp(`${hpBefore}→${Math.max(0, target.hp)}`),
    ],
    "skill",
    skillDamageActions(u, target, dmg),
  );
  u.skillUses = u.skillUses - 1;
  resolveDeaths(ctx);
}

export function applyBeforeAttackSkills(
  board: BattleUnit[],
  enemyBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (board.length <= 1) return;
  const u = mustGet(board, SUPPORT_IDX, "before-attack board[SUPPORT_IDX]");
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, SUPPORT_IDX);

  for (let m = 0; m < mult; m++) {
    if (u.id === "parasite") applyParasiteBuff(u, prefix, ctx);
    if (u.id === "eye") applyEyeGaze(u, enemyBoard, prefix, ctx);
  }
}

export function applyOnHitSkills(
  defender: BattleUnit,
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (defender.hp <= 0) return;
  const idx = board.indexOf(defender);
  if (idx === -1) return;
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, idx);

  for (let m = 0; m < mult; m++) {
    if (defender.id === "templar") {
      const b = atLevel(TEMPLAR.atkBuff, defender.level);
      defender.atk += b;
      pushFrame(
        ctx,
        "skill",
        [prefix, seg.u(defender.name), "が傷を受け、嗤う。", seg.s(`+${b}/+0`)],
        "skill",
        {
          [defender.uid]: { type: "buff", value: `+${b}/+0` },
        },
      );
    }
  }
}

export { applyEquipmentEffects } from "./battle-equip";
