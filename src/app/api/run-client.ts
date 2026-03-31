import { apiFetch } from "./fetch";
import type { Result, InfraError } from "../../shared/errors";
import type { RunState, CurrentRunState } from "../../shared/api-types";

export async function startRun(originId: string | null): Promise<Result<RunState, InfraError>> {
  const result = await apiFetch<{ run: RunState }>("/api/run/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originId }),
  });
  return result.map((data) => data.run);
}

export async function getCurrentRun(): Promise<Result<CurrentRunState | null, InfraError>> {
  const result = await apiFetch<{ run: CurrentRunState | null }>("/api/run/current");
  return result.map((data) => data.run);
}

export async function advanceRun(battleId: string): Promise<Result<RunState, InfraError>> {
  const result = await apiFetch<{ run: RunState }>("/api/run/advance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ battleId }),
  });
  return result.map((data) => data.run);
}

export async function retireRun(): Promise<Result<void, InfraError>> {
  const result = await apiFetch<{ ok: boolean }>("/api/run/retire", {
    method: "POST",
  });
  return result.map(() => undefined);
}
