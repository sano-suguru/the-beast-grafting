import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr, ok, err } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import type { BoardUnit } from "../../shared/board-unit";
import type { RunStatus, ServerBattleResult } from "../../shared/api-types";
import { runs, battles, shopStates } from "../../db/schema";

interface AdvanceFields {
  round: number;
  life: number;
  trophy: number;
  board: (BoardUnit | null)[];
  status: RunStatus;
}

/**
 * Consume a battle then advance the run. Returns false if already consumed or run no longer active.
 * D1 にトランザクションがないため2段階で実行する。consume 成功後の advance がインフラエラーで
 * 失敗した場合、battle は consumed 済みだが run は未更新になる。この中間状態は
 * クライアントの recoverPendingBattle (game-actions.ts) がカバーする。
 */
export async function consumeAndAdvance(
  db: DrizzleD1Database,
  battleId: string,
  runId: string,
  fields: AdvanceFields,
): Promise<Result<boolean, InfraError>> {
  const consumed = await safeAsync(
    () =>
      db
        .update(battles)
        .set({ consumed: true })
        .where(and(eq(battles.id, battleId), eq(battles.consumed, false)))
        .returning({ id: battles.id }),
    dbErr,
  );
  if (consumed.isErr()) return err(consumed.error);
  if (consumed.value.length === 0) return ok(false);

  const advanced = await safeAsync(
    () =>
      db
        .update(runs)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(runs.id, runId), eq(runs.status, "active")))
        .returning({ id: runs.id }),
    dbErr,
  );
  if (advanced.isErr()) return err(advanced.error);
  if (advanced.value.length > 0) return ok(true);
  return ok(false);
}

const WIN_THRESHOLD = 10;

export type BattleRow = {
  result: ServerBattleResult;
  playerId: string;
  runId: string;
  round: number;
  consumed: boolean;
};

export function fetchBattle(db: DrizzleD1Database, battleId: string) {
  return safeAsync(
    () =>
      db
        .select({
          result: battles.result,
          playerId: battles.playerId,
          runId: battles.runId,
          round: battles.round,
          consumed: battles.consumed,
        })
        .from(battles)
        .where(eq(battles.id, battleId))
        .limit(1),
    dbErr,
  );
}

export function validateBattleForRun(
  battle: BattleRow,
  run: { id: string; round: number },
): string | null {
  if (battle.runId !== run.id) return "run_mismatch";
  if (battle.round !== run.round) return "round_mismatch";
  if (battle.consumed) return "battle_already_consumed";
  return null;
}

export function computeAdvanceFields(
  run: {
    round: number;
    life: number;
    trophy: number;
    status: RunStatus;
    board: (BoardUnit | null)[];
  },
  battleResultStr: ServerBattleResult,
): AdvanceFields {
  let life = run.life;
  let trophy = run.trophy;
  let status: RunStatus = run.status;

  if (battleResultStr === "WIN") {
    trophy += 1;
    if (trophy >= WIN_THRESHOLD) status = "won";
  } else if (battleResultStr === "LOSE") {
    life = Math.max(0, life - 1);
    if (life <= 0) status = "lost";
  }

  return {
    round: status === "active" ? run.round + 1 : run.round,
    life,
    trophy,
    board: run.board as (BoardUnit | null)[],
    status,
  };
}

export function fetchActiveRun(db: DrizzleD1Database, playerId: string) {
  return safeAsync(
    () =>
      db
        .select()
        .from(runs)
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
}

export function fetchLatestBoard(db: DrizzleD1Database, runId: string, round: number) {
  return safeAsync(
    () =>
      db
        .select({ board: shopStates.board })
        .from(shopStates)
        .where(and(eq(shopStates.runId, runId), eq(shopStates.round, round)))
        .limit(1),
    dbErr,
  );
}
