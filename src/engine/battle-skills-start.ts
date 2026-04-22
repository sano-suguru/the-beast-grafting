import type { BattleUnit } from "./battle-context";
import {
  pushFrame,
  enemyPrefix,
  seg,
  aoeBuffActions,
  buffAction,
  buffAllAlive,
} from "./battle-context";
import { mustGet } from "../shared/invariant";
import { applySkillDamage, type SkillContext } from "./battle-skills-util";
import {
  atLevel,
  BAT,
  INQUISITOR,
  BANSHEE,
  AMNIOTIC_ARMOR,
  FAMINE_CORPSE,
  PALADIN,
  HOLY_FIRE,
  MARKET_VULTURE,
  ORGAN_GRINDER,
} from "../shared/skill-params";

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
      () => [
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
    () => [
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
  if (targetArr.length === 0) return;
  const dmg = BANSHEE.damage;
  const uses = atLevel(BANSHEE.uses, u.level);
  for (let i = 0; i < uses; i++) {
    const alive = targetArr.filter((e) => e.hp > 0);
    if (alive.length === 0) return;
    const back = alive[alive.length - 1]!;
    const hpBefore = back.hp;
    applySkillDamage(
      u,
      back,
      dmg,
      () => [
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
}

export function applyAmnioticArmorSkill({ u, isPlayer, ctx }: SkillContext) {
  const buff = { atk: 0, hp: atLevel(AMNIOTIC_ARMOR.hpBuff, u.level) };
  const affected = [...buffAllAlive(ctx.pBoard, buff), ...buffAllAlive(ctx.eBoard, buff)];
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の羊膜が弾ける。濁った粘液が戦場全体の肉を覆い、味方も敵もひと回り厚くなる。",
      seg.s(`+0/+${buff.hp}`),
    ],
    "skill",
    aoeBuffActions(u, affected, buff),
  );
}

export function applyFamineCorpseSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const dmg = FAMINE_CORPSE.damage;
  const uses = atLevel(FAMINE_CORPSE.uses, u.level);
  for (let i = 0; i < uses; i++) {
    const alive = targetArr.filter((e) => e.hp > 0);
    if (alive.length === 0) return;
    let lowestHp = alive[0]!;
    for (const e of alive) {
      if (e.hp < lowestHp.hp) lowestHp = e;
    }
    const hpBefore = lowestHp.hp;
    applySkillDamage(
      u,
      lowestHp,
      dmg,
      () => [
        seg.u(u.name),
        "が飢餓を放つ！ ",
        seg.u(lowestHp.name),
        "に ",
        seg.hp(`${hpBefore}→${Math.max(0, hpBefore - dmg)}`),
      ],
      isPlayer,
      ctx,
    );
  }
}

export function applyMarketVultureSkill({ u, isPlayer, ctx }: SkillContext) {
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  let maxHp = 0;
  for (const ally of allyBoard) {
    if (ally.uid === u.uid || ally.hp <= 0) continue;
    if (ally.hp > maxHp) maxHp = ally.hp;
  }
  if (maxHp === 0) return;
  const percent = atLevel(MARKET_VULTURE.percent, u.level);
  const hpGain = Math.max(1, Math.floor((maxHp * percent) / 100));
  u.hp += hpGain;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が味方の血を啜る。殻が膨らんでいく。", seg.s(`+0/+${hpGain}`)],
    "skill",
    { [u.uid]: buffAction({ atk: 0, hp: hpGain }, u.uid) },
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
    () => [
      prefix,
      seg.u(u.name),
      "が手を掲げる。淡い光が味方の傷を塞いでいく。",
      seg.s(`+0/+${hpBuff}`),
    ],
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
    () => [
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

export function applyOrganGrinderSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  const targetCount = atLevel(ORGAN_GRINDER.targets, u.level);
  const dmg = Math.floor((u.atk * ORGAN_GRINDER.percent) / 100);
  if (dmg <= 0) return;
  for (let i = 0; i < targetCount; i++) {
    const alive = targetArr.filter((e) => e.hp > 0);
    if (alive.length === 0) return;
    const target = mustGet(
      alive,
      Math.floor(ctx.rng.next() * alive.length),
      "organ_grinder target",
    );
    const hpBefore = target.hp;
    applySkillDamage(
      u,
      target,
      dmg,
      () => [
        seg.u(u.name),
        "が臓腑を撒く！ ",
        seg.u(target.name),
        "に ",
        seg.hp(`${hpBefore}→${Math.max(0, hpBefore - dmg)}`),
      ],
      isPlayer,
      ctx,
    );
  }
}
