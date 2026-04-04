import type { BattleAction, LogSegment, UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg, skillDamageActions } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../shared/invariant";
import {
  BAT_DAMAGE,
  BANSHEE_DAMAGE,
  PARASITE_BUFF,
  EYE_DAMAGE,
  REVENANT_MAX_TARGETS,
  SUPPORT_IDX,
} from "./constants";

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
  const target = mustGet(targetArr, Math.floor(ctx.rng.next() * targetArr.length), "bat target");
  const hpBefore = target.hp;
  applySkillDamage(
    u,
    target,
    BAT_DAMAGE,
    [
      seg.u(u.name),
      "が喰らいつく！ ",
      seg.u(target.name),
      "に ",
      seg.hp(`${hpBefore}→${Math.max(0, hpBefore - BAT_DAMAGE)}`),
    ],
    isPlayer,
    ctx,
  );
}

function applyBansheeSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  const back = targetArr[targetArr.length - 1];
  if (!back) return;
  const hpBefore = back.hp;
  applySkillDamage(
    u,
    back,
    BANSHEE_DAMAGE,
    [
      seg.u(u.name),
      "が叫ぶ！ 最後尾の",
      seg.u(back.name),
      "に ",
      seg.hp(`${hpBefore}→${Math.max(0, hpBefore - BANSHEE_DAMAGE)}`),
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
  const actions: Record<string, BattleAction> = {
    [u.uid]: { type: "skill" },
  };
  let buffed = 0;
  for (const ally of allyBoard) {
    if (buffed >= REVENANT_MAX_TARGETS) break;
    if (ally.uid === u.uid) continue;
    ally.atk += 1;
    actions[ally.uid] = { type: "buff", value: "+1/+0" };
    buffed++;
  }
  if (buffed > 0) {
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(u.name), `の眼が血走る。前方${buffed}体の攻撃力+1。`],
      "skill",
      actions,
    );
  }
}

const START_SKILL_HANDLERS = {
  bat: applyBatSkill,
  inquisitor: applyBatSkill,
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
  u.atk += PARASITE_BUFF.atk;
  u.hp += PARASITE_BUFF.hp;
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "が前衛の闘争に興奮する！ ",
      seg.s(`+${PARASITE_BUFF.atk}/+${PARASITE_BUFF.hp}`),
    ],
    "skill",
    { [u.uid]: { type: "buff", value: `+${PARASITE_BUFF.atk}/+${PARASITE_BUFF.hp}` } },
  );
}

function applyEyeGaze(u: BattleUnit, enemyBoard: BattleUnit[], prefix: string, ctx: BattleContext) {
  if (enemyBoard.length === 0 || u.skillUses <= 0) return;
  const target = mustGet(enemyBoard, Math.floor(ctx.rng.next() * enemyBoard.length), "eye target");
  const hpBefore = target.hp;
  target.hp -= EYE_DAMAGE;
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
    skillDamageActions(u, target, EYE_DAMAGE),
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
      defender.atk += 1;
      pushFrame(
        ctx,
        "skill",
        [prefix, seg.u(defender.name), "が傷を受け、嗤う。", seg.s("+1/+0")],
        "skill",
        {
          [defender.uid]: { type: "buff", value: "+1/+0" },
        },
      );
    }
  }
}

export { applyEquipmentEffects } from "./battle-equip";
