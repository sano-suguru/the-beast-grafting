import type { Result } from "../../shared/errors";
import type { InfraError } from "../../shared/errors";
import type { LoreResponse } from "../../shared/api-types";
import { apiFetch } from "./fetch";

export async function fetchLore(): Promise<Result<LoreResponse, InfraError>> {
  const result = await apiFetch<{ lore: LoreResponse }>("/api/lore");
  return result.map((data) => data.lore);
}
