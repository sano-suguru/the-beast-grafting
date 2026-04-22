import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  takeDamage,
  seg,
  skillDamageActions,
  buffAction,
  skillAction,
} from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../shared/invariant";
import { atLevel, EYE, RELIC_SWORD, CRAWLING_CORD, HOWLING_GIANT } from "../shared/skill-params";

export function applyEyeGaze(
  u: BattleUnit,
  enemyBoard: BattleUnit[],
  prefix: string,
  ctx: BattleContext,
) {
  if (enemyBoard.length === 0 || u.skillUses <= 0) return;
  const target = mustGet(enemyBoard, Math.floor(ctx.rng.next() * enemyBoard.length), "eye target");
  const dmg = atLevel(EYE.damage, u.level);
  const hpBefore = target.hp;
  takeDamage(target, dmg, ctx, u.uid);
  pushFrame(
    ctx,
    "skill",
    () => [
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

export function applyRelicSwordBuff(
  u: BattleUnit,
  board: BattleUnit[],
  prefix: string,
  ctx: BattleContext,
) {
  const ally = board[0];
  if (!ally) return;
  const atkGain = atLevel(RELIC_SWORD.atkBuff, u.level);
  ally.atk += atkGain;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "が白く脈打つ。",
      seg.u(ally.name),
      "の握る指が柄と同じ色に染まる。",
      seg.s(`+${atkGain}/+0`),
    ],
    "skill",
    { [u.uid]: skillAction(), [ally.uid]: buffAction({ atk: atkGain, hp: 0 }, u.uid) },
  );
}

export function applyCrawlingCordBuff(u: BattleUnit, prefix: string, ctx: BattleContext) {
  const b = atLevel(CRAWLING_CORD.buff, u.level);
  u.atk += b.atk;
  u.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "が蠢き、前衛の闘争に呼応して膨れ上がる。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [u.uid]: buffAction(b, u.uid) },
  );
}

export function applyHowlingGiantBuff(u: BattleUnit, prefix: string, ctx: BattleContext) {
  const b = atLevel(HOWLING_GIANT.buff, u.level);
  u.atk += b.atk;
  u.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "が吼える。息を吸うたび、骨が軋む。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [u.uid]: buffAction(b, u.uid) },
  );
}
