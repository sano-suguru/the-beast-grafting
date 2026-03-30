import { eq, and, ne, between, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import type { PvpOpponent } from "../../shared/board-unit";
import { players, boardSnapshots, runs } from "../../db/schema";

const ROUND_RANGE = 1;

// SAP系ゲームの仕様: 対戦相手のスナップショットは過去データの再利用であり、
// 複数プレイヤーが同一スナップショットと対戦するのは意図的な設計。
// 1:1排他マッチングは不要。
export function findOpponent(
  db: DrizzleD1Database,
  playerId: string,
  round: number,
): Promise<Result<PvpOpponent | null, InfraError>> {
  const minRound = Math.max(1, round - ROUND_RANGE);
  const maxRound = round + ROUND_RANGE;

  return safeAsync(async () => {
    const rows = await db
      .select({
        playerId: boardSnapshots.playerId,
        displayName: players.displayName,
        board: boardSnapshots.board,
      })
      .from(boardSnapshots)
      .innerJoin(players, eq(boardSnapshots.playerId, players.id))
      .innerJoin(runs, eq(boardSnapshots.runId, runs.id))
      .where(
        and(
          between(boardSnapshots.round, minRound, maxRound),
          ne(boardSnapshots.playerId, playerId),
          eq(runs.status, "active"),
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      playerId: row.playerId,
      teamName: `[同業者] ${row.displayName}`,
      teamType: "同業者" as const,
      units: row.board,
    };
  }, dbErr);
}
