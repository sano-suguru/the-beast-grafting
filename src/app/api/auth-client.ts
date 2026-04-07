import type { AuthProvider } from "../../shared/auth-provider";
import { apiFetch } from "./fetch";
import type { Result, InfraError } from "../../shared/errors";

interface MeResponse {
  playerId: string;
  displayName: string;
  providers: AuthProvider[];
}

interface GuestResponse {
  playerId: string;
  displayName: string;
}

export async function fetchMe(): Promise<Result<MeResponse, InfraError>> {
  return apiFetch<MeResponse>("/api/auth/me");
}

export async function createGuest(): Promise<Result<GuestResponse, InfraError>> {
  return apiFetch<GuestResponse>("/api/auth/guest", { method: "POST" });
}

export async function logout(): Promise<Result<void, InfraError>> {
  const result = await apiFetch<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
  return result.map(() => undefined);
}

export async function updateDisplayName(
  displayName: string,
): Promise<Result<{ displayName: string }, InfraError>> {
  return apiFetch<{ displayName: string }>("/api/auth/name", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
}
