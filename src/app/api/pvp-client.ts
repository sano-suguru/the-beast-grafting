import { apiFetch } from "./fetch";
import type { Result, InfraError } from "../../shared/errors";
import { unitInstanceToBoardUnit } from "../../shared/board-unit";
import { isEnemyFaction } from "../../shared/enemy-faction";
import { invariant } from "../../shared/invariant";
import type { UnitInstance } from "../types";
import type { BattleResponse } from "../../shared/api-types";

export async function uploadSnapshot(
  runId: string,
  round: number,
  units: UnitInstance[],
): Promise<Result<void, InfraError>> {
  const result = await apiFetch<{ ok: boolean }>("/api/pvp/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId, round, board: units.map(unitInstanceToBoardUnit) }),
  });
  return result.map(() => undefined);
}

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
