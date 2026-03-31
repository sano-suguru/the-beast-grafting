import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix } from "./battle-context";
import { invariant } from "../shared/invariant";
import {
  getDeathHandler,
  handleEquipDeath,
  handleBeelzebubSpawns,
  handleEvangelistPlague,
} from "./battle-deaths-handlers";
import { DEATH_CASCADE_LIMIT, ALTAR_BUFF, FRAME_DELAY_DEATH_CHAIN } from "./constants";

function applyAltarBuffs(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  const prefix = enemyPrefix(isPlayer);
  board.forEach((u) => {
    if (u.id !== "token" || u.altarBuffed) return;
    board.forEach((a, aIdx) => {
      if (a.id !== "altar") return;
      const mult = getMult(board, aIdx);
      const atkBuff = ALTAR_BUFF.atk * mult;
      const hpBuff = ALTAR_BUFF.hp * mult;
      u.atk += atkBuff;
      u.hp += hpBuff;
      pushFrame(
        ctx,
        "skill",
        `${prefix}[${a.name}]の邪神の祝福！召喚された[${u.name}]に+${atkBuff}/+${hpBuff} → (${u.atk}/${u.hp})`,
        "skill",
        {
          [u.uid]: { type: "buff", value: `+${atkBuff}/+${hpBuff}` },
        },
        FRAME_DELAY_DEATH_CHAIN,
      );
    });
    u.altarBuffed = true;
  });
}

function processSideDeaths(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext): boolean {
  // SAP準拠: ATK降順で死亡解決（同値ならHP降順、さらに同値なら均一ランダム）
  const deadUnits: { idx: number; unit: BattleUnit }[] = [];
  for (let i = 0; i < board.length; i++) {
    const unit = board[i];
    if (unit && unit.hp <= 0) deadUnits.push({ idx: i, unit });
  }
  if (deadUnits.length === 0) return false;

  const bestAtk = Math.max(...deadUnits.map((d) => d.unit.atk));
  const atkPool = deadUnits.filter((d) => d.unit.atk === bestAtk);
  const bestHp = Math.max(...atkPool.map((d) => d.unit.hp));
  const finalPool = atkPool.filter((d) => d.unit.hp === bestHp);
  const chosen = finalPool[Math.floor(ctx.rng.next() * finalPool.length)];
  invariant(chosen, "chosen dead unit must exist (finalPool is non-empty)");
  const bestIdx = chosen.idx;

  const dead = board[bestIdx];
  invariant(dead, "dead unit must exist at bestIdx");
  const mult = getMult(board, bestIdx);

  // 死亡フレームをsplice前にpush（ユニットがボード上に残った状態でスナップショット → 死亡アニメ再生用）
  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "death", `${prefix}[${dead.name}] は無残に引き裂かれた。`, "death", {
    [dead.uid]: { type: "death" },
  });

  board.splice(bestIdx, 1);
  const insertIdx = bestIdx;
  // successor をループ前にキャプチャ（splice 後のボード状態で、spawn による変更前）
  const successor = insertIdx < board.length ? (board[insertIdx] ?? null) : null;
  const successor2 = insertIdx + 1 < board.length ? (board[insertIdx + 1] ?? null) : null;

  const handler = getDeathHandler(dead.id);
  for (let m = 0; m < mult; m++) {
    if (handler) handler({ dead, board, idx: insertIdx, isPlayer, ctx, successor, successor2 });
    handleEquipDeath(dead, board, insertIdx, isPlayer, ctx);
  }
  if (dead.id !== "token") {
    handleBeelzebubSpawns(board, isPlayer, ctx, insertIdx);
  }
  // SAP準拠: processSideDeaths は ATK降順で1体ずつ死亡解決する。
  // evangelist の "味方死亡" トリガーは各死亡後に独立発火し、
  // resolveDeaths のカスケードループで後続死亡も順次処理される。
  // splice(L65)済みのため死んだevangelist自身は発火しない。
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  handleEvangelistPlague(board, enemyBoard, isPlayer, ctx);
  return true;
}

export function resolveDeaths(ctx: BattleContext) {
  let loopSafety = 0;
  let deathOccurred = true;

  while (deathOccurred && loopSafety < DEATH_CASCADE_LIMIT) {
    deathOccurred = false;
    loopSafety++;

    if (processSideDeaths(ctx.pBoard, true, ctx)) {
      deathOccurred = true;
    }
    if (processSideDeaths(ctx.eBoard, false, ctx)) {
      deathOccurred = true;
    }

    applyAltarBuffs(ctx.pBoard, true, ctx);
    applyAltarBuffs(ctx.eBoard, false, ctx);
  }
}
