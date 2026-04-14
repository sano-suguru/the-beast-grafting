import type { BattleAction, UnitId } from "../shared/types";
import type { BattleUnit } from "./battle-context";
import {
  pushFrame,
  takeDamage,
  enemyPrefix,
  seg,
  aoeBuffActions,
  buffAction,
  skillAction,
  damageAction,
} from "./battle-context";
import { mustGet } from "../shared/invariant";
import { applySkillDamage, type SkillContext } from "./battle-skills-util";
import {
  atLevel,
  BAT,
  INQUISITOR,
  BANSHEE,
  REVENANT,
  CATACOMB_RAT,
  PALADIN,
  HOLY_FIRE,
  CORRODING_MOLD,
} from "../shared/skill-params";
import { getInitOverride } from "./battle-init-overrides";

export function applyBatSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
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

export function applyInquisitorSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
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

export function applyBansheeSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
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
  const selfDmg = atLevel(BANSHEE.selfDamage, u.level);
  const selfBefore = u.hp;
  takeDamage(u, selfDmg);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "の喉が裂ける。",
      seg.hp(`${selfBefore}→${Math.max(0, selfBefore - selfDmg)}`),
    ],
    "skill",
    { [u.uid]: damageAction(selfDmg) },
  );
}

export function applyRevenantSkill({ u, isPlayer, ctx }: SkillContext) {
  if (ctx.lastBattleResult !== "LOSE") return;
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const prefix = enemyPrefix(isPlayer);
  const maxTargets = atLevel(REVENANT.targets, u.level);
  const buffAmount = atLevel(REVENANT.buff, u.level);
  const actions: Record<string, BattleAction> = {
    [u.uid]: skillAction(),
  };
  let buffed = 0;
  for (const ally of allyBoard) {
    if (buffed >= maxTargets) break;
    if (ally.uid === u.uid) continue;
    ally.atk += buffAmount;
    actions[ally.uid] = buffAction({ atk: buffAmount, hp: 0 }, u.uid);
    buffed++;
  }
  if (buffed > 0) {
    pushFrame(
      ctx,
      "skill",
      [
        prefix,
        seg.u(u.name),
        `の眼が血走る。前方${buffed}体の肉が脈打つ。`,
        seg.s(`+${buffAmount}/+0`),
      ],
      "skill",
      actions,
    );
  }
}

export function applyCatacombRatSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const idx = Math.floor(ctx.rng.next() * targetArr.length);
  const victim = mustGet(targetArr, idx, "catacomb_rat target");
  const tierDmg = u.tier * atLevel(CATACOMB_RAT.tierMult, u.level);
  const before = victim.hp;
  applySkillDamage(
    u,
    victim,
    tierDmg,
    [
      seg.u(u.name),
      "が聖骨を齧る！ ",
      seg.u(victim.name),
      "に ",
      seg.hp(`${before}→${Math.max(0, before - tierDmg)}`),
    ],
    isPlayer,
    ctx,
  );
}

export function applyPaladinSkill({ u, isPlayer, ctx }: SkillContext) {
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const prefix = enemyPrefix(isPlayer);
  const hpBuff = atLevel(PALADIN.hpBuff, u.level);
  const buffed: BattleUnit[] = [];
  for (const ally of allyBoard) {
    if (ally.hp <= 0) continue;
    ally.hp += hpBuff;
    buffed.push(ally);
  }
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(u.name), "が手を掲げる。淡い光が味方の傷を塞いでいく。", seg.s(`+0/+${hpBuff}`)],
    "skill",
    aoeBuffActions(u, buffed, { atk: 0, hp: hpBuff }),
  );
}

export function applyHolyFireSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  let maxHp = -1;
  let target = mustGet(targetArr, 0, "holy_fire target");
  for (const e of targetArr) {
    if (e.hp > maxHp) {
      maxHp = e.hp;
      target = e;
    }
  }
  const dmg = atLevel(HOLY_FIRE.damage, u.level);
  const hpBefore = target.hp;
  applySkillDamage(
    u,
    target,
    dmg,
    [
      seg.u(u.name),
      "が降り注ぐ！ ",
      seg.u(target.name),
      "に ",
      seg.hp(`${hpBefore}→${Math.max(0, hpBefore - dmg)}`),
    ],
    isPlayer,
    ctx,
  );
}

export function applyDevouringGraftSkill({ u, isPlayer, ctx }: SkillContext) {
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const idx = allyBoard.indexOf(u);
  if (idx <= 0) return;
  const pred = allyBoard[idx - 1]!;
  ctx.absorbedUnits.set(u.uid, {
    id: pred.id,
    name: pred.name,
    tier: pred.tier,
    atk: pred.atk,
    hp: pred.hp,
    isChurch: pred.isChurch,
    equip: pred.equip,
  });
  u.atk += pred.atk;
  u.hp += pred.hp;
  allyBoard.splice(idx - 1, 1);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "が",
      seg.u(pred.name),
      "を丸呑みにした！ ",
      seg.s(`+${pred.atk}/+${pred.hp}`),
    ],
    "skill",
    { [u.uid]: buffAction({ atk: pred.atk, hp: pred.hp }, u.uid) },
  );
}

export function applyCorrodingMoldSkill({ u, isPlayer, ctx }: SkillContext) {
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const idx = allyBoard.indexOf(u);
  if (idx <= 0) return;
  const front = allyBoard[idx - 1]!;
  if (front.hp <= 0) return;
  const b = atLevel(CORRODING_MOLD.buff, u.level);
  front.atk += b.atk;
  front.hp += b.hp;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(u.name), "が", seg.u(front.name), "に侵蝕する。", seg.s(`+${b.atk}/+${b.hp}`)],
    "skill",
    { [front.uid]: buffAction(b, u.uid) },
  );
}

export function applyMimickingFleshSkill(
  ctx_: SkillContext,
  getStartHandler: (id: UnitId) => ((c: SkillContext) => void) | undefined,
) {
  const { u, targetArr, isPlayer, ctx } = ctx_;
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const idx = allyBoard.indexOf(u);
  if (idx <= 0) return;
  // 最前線ユニットを模倣する（直前の味方ではなく戦場の主役を真似る）
  const pred = allyBoard[0]!;
  // TokenIdはDataUnitIdに属さず、UNITS/CHURCH_UNITSにスキル定義が存在しないためコピー不可
  if (pred.id === "token") return;
  const prevName = u.name;
  u.id = pred.id;
  u.name = pred.name;
  const initOv = getInitOverride(u.id);
  if (initOv) initOv(u);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(prevName), "が震え、", seg.u(pred.name), "の形に変わる。"],
    "skill",
    { [u.uid]: skillAction() },
  );
  const handler = getStartHandler(u.id);
  if (handler) handler({ u, targetArr, isPlayer, ctx });
}
