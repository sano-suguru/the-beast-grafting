import type { UnitId } from "../shared/types";
import { pushFrame, enemyPrefix, seg, buffAction, skillAction } from "./battle-context";
import { atLevel, CORRODING_MOLD, EVANGELIST } from "../shared/skill-params";
import { getInitOverride } from "./battle-init-overrides";
import { applySkillDamage, type SkillContext } from "./battle-skills-util";

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
  allyBoard.splice(idx - 1, 1);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が", seg.u(pred.name), "を丸呑みにした！"],
    "skill",
    { [u.uid]: skillAction() },
  );
}

export function applyEvangelistSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  const aliveTargets = targetArr.filter((e) => e.hp > 0);
  if (aliveTargets.length === 0) return;
  let target = aliveTargets[0]!;
  for (const e of aliveTargets) {
    if (e.hp > target.hp) target = e;
  }
  const percent = atLevel(EVANGELIST.reductionPercent, u.level);
  const hpBefore = target.hp;
  const dmg = Math.max(1, Math.floor((hpBefore * percent) / 100));
  applySkillDamage(
    u,
    target,
    dmg,
    () => [
      seg.u(u.name),
      "の瘴気が",
      seg.u(target.name),
      "に纏わりつく。",
      seg.hp(`${hpBefore}→${Math.max(0, target.hp)}`),
    ],
    isPlayer,
    ctx,
  );
}

export function applyCorrodingMoldSkill({ u, isPlayer, ctx }: SkillContext) {
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const idx = allyBoard.indexOf(u);
  if (idx <= 0) return;
  const front = allyBoard[idx - 1]!;
  if (front.hp <= 0) return;
  const percent = atLevel(CORRODING_MOLD.percent, u.level);
  const atkBuff = Math.max(1, Math.floor((u.atk * percent) / 100));
  front.atk += atkBuff;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が", seg.u(front.name), "に侵蝕する。", seg.s(`+${atkBuff}/+0`)],
    "skill",
    { [front.uid]: buffAction({ atk: atkBuff, hp: 0 }, u.uid) },
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
  const pred = allyBoard[idx - 1];
  // TokenIdはDataUnitIdに属さず、UNITS/CHURCH_UNITSにスキル定義が存在しないためコピー不可
  if (!pred || pred.id === "token") return;
  const prevName = u.name;
  u.id = pred.id;
  u.name = pred.name;
  const initOv = getInitOverride(u.id);
  if (initOv) initOv(u);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(prevName), "が震え、", seg.u(pred.name), "の形に変わる。"],
    "skill",
    { [u.uid]: skillAction() },
  );
  const handler = getStartHandler(u.id);
  if (handler) handler({ u, targetArr, isPlayer, ctx });
}
