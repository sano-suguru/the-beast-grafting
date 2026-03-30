import { apiFetch } from "./fetch";
import type { Result, InfraError } from "../../shared/errors";
import { isEnemyFaction } from "../../shared/enemy-faction";
import { invariant } from "../../shared/invariant";
import type { BattleResponse } from "../../shared/api-types";

export async function requestBattle(
  runId: string,
  round: number,
): Promise<Result<BattleResponse, InfraError>> {
  const result = await apiFetch<BattleResponse>("/api/pvp/battle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId, round }),
  });
  if (result.isOk()) {
    invariant(
      isEnemyFaction(result.value.opponent.teamType),
      `invalid teamType: ${result.value.opponent.teamType}`,
    );
  }
  return result;
}
