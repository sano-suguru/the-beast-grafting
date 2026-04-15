import { mustGet } from "../shared/invariant";
import { pushFrame, enemyPrefix, seg, buffAction } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, ASH_FUNGUS } from "../shared/skill-params";
import type { DeathContext } from "./battle-deaths-handlers-unit";

export function handleAshFungusDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  const percent = atLevel(ASH_FUNGUS.percent, dead.level);
  const totalStats = dead.preDeathHp + dead.atk;
  const buff = Math.floor((totalStats * percent) / 100);
  if (buff <= 0) return;
  const alive = board.filter((u) => u.hp > 0);
  if (alive.length === 0) return;
  const target = mustGet(alive, Math.floor(ctx.rng.next() * alive.length), "ash_fungus target");
  const half = Math.floor(buff / 2);
  const atkBuff = buff - half;
  const hpBuff = half;
  target.atk += atkBuff;
  target.hp += hpBuff;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(dead.name),
      "の胞子が",
      seg.u(target.name),
      "に纏わる。",
      seg.s(`+${atkBuff}/+${hpBuff}`),
    ],
    "skill",
    { [target.uid]: buffAction({ atk: atkBuff, hp: hpBuff }, dead.uid) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}
