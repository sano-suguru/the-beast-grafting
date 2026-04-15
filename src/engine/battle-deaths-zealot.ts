import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg, buffAction } from "./battle-context";
import { invariant } from "../shared/invariant";
import { computeZealotBuff } from "./buff-utils";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";

export function applyZealotBuff(
  boardArray: BattleUnit[],
  tokenUid: string,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const buffAmount = computeZealotBuff(boardArray, {
    requireAlive: true,
    getMultiplier: (idx) => getMult(boardArray, idx),
  });
  if (buffAmount <= 0) return;
  const zealot = boardArray.find((u) => u.id === "zealot" && u.hp > 0);
  invariant(zealot, "zealot must exist when buffAmount > 0");
  const zealotName = zealot.name;
  const token = boardArray.find((u) => u.uid === tokenUid);
  invariant(token, "zealot: token must exist after spawn");
  token.atk += buffAmount;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(zealotName),
      "が呪詛を唱える！ ",
      seg.u(token.name),
      "の肉が漲る。",
      seg.s(`+${buffAmount}/+0`),
    ],
    "skill",
    { [tokenUid]: buffAction({ atk: buffAmount, hp: 0 }, zealot.uid) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}
