import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, takeDamage, seg, skillDamageActions } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../shared/invariant";
import { atLevel, PARASITE, EYE, FAMINE_CORPSE, RELIC_SWORD } from "../shared/skill-params";

export function applyParasiteBuff(u: BattleUnit, prefix: string, ctx: BattleContext) {
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
  takeDamage(target, dmg);
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

export function applyFamineDebuff(
  u: BattleUnit,
  enemyBoard: BattleUnit[],
  prefix: string,
  ctx: BattleContext,
) {
  if (enemyBoard.length === 0) return;
  const front = mustGet(enemyBoard, 0, "famine front");
  const debuff = atLevel(FAMINE_CORPSE.atkDebuff, u.level);
  front.atk = Math.max(1, front.atk - debuff);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "が",
      seg.u(front.name),
      `に群がる。肉が痩せ細っていく。攻撃-${debuff}`,
    ],
    "skill",
    { [u.uid]: { type: "skill" }, [front.uid]: { type: "defend", value: `-${debuff}/+0` } },
  );
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
    [
      prefix,
      seg.u(u.name),
      "が白く脈打つ。",
      seg.u(ally.name),
      `の握る指が柄と同じ色に染まる。攻撃+${atkGain}`,
    ],
    "skill",
    { [u.uid]: { type: "skill" }, [ally.uid]: { type: "buff", value: `+${atkGain}/+0` } },
  );
}
