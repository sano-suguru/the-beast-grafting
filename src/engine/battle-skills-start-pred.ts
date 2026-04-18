import type { UnitId } from "../shared/types";
import { pushFrame, enemyPrefix, seg, buffAction, skillAction } from "./battle-context";
import { atLevel, CORRODING_MOLD } from "../shared/skill-params";
import { DEVOURING_GRAFT } from "../shared/skill-params-death";
import { getInitOverride } from "./battle-init-overrides";
import type { SkillContext } from "./battle-skills-util";

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
  const absorbRate = atLevel(DEVOURING_GRAFT.absorbPercent, u.level) / 100;
  const gainedAtk = Math.floor(pred.atk * absorbRate);
  const gainedHp = Math.floor(pred.hp * absorbRate);
  u.atk += gainedAtk;
  u.hp += gainedHp;
  allyBoard.splice(idx - 1, 1);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "が",
      seg.u(pred.name),
      "を丸呑みにした！ ",
      seg.s(`+${gainedAtk}/+${gainedHp}`),
    ],
    "skill",
    { [u.uid]: buffAction({ atk: gainedAtk, hp: gainedHp }, u.uid) },
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
    () => [
      prefix,
      seg.u(u.name),
      "が",
      seg.u(front.name),
      "に侵蝕する。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
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
