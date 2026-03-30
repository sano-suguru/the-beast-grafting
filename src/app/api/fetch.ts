import { ok, err, safeAsync } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";

const TIMEOUT_MS = 15_000;

const apiFetchErr =
  (status: number) =>
  (cause: unknown): InfraError => ({ type: "API_FETCH_FAILED", status, cause });

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<Result<T, InfraError>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const res = await safeAsync(
    () => fetch(path, { ...init, credentials: "include", signal: controller.signal }),
    apiFetchErr(0),
  );
  clearTimeout(timer);
  if (res.isErr()) return err(res.error);

  const response = res.value;
  if (!response.ok) {
    if (response.status === 401) sessionPromise = null;
    return err({ type: "API_FETCH_FAILED", status: response.status, cause: null });
  }

  const json = await safeAsync(() => response.json(), apiFetchErr(response.status));
  if (json.isErr()) return json;
  if (typeof json.value !== "object" || json.value === null) {
    return err({
      type: "API_FETCH_FAILED",
      status: response.status,
      cause: "unexpected response shape",
    });
  }
  return ok(json.value as T);
}

let sessionPromise: Promise<Result<void, InfraError>> | null = null;

export async function ensureSession(): Promise<Result<void, InfraError>> {
  if (sessionPromise) return sessionPromise;

  sessionPromise = doEnsureSession();
  const result = await sessionPromise;
  if (result.isErr()) sessionPromise = null;
  return result;
}

async function doEnsureSession(): Promise<Result<void, InfraError>> {
  const me = await apiFetch<{ playerId: string }>("/api/auth/me");
  if (me.isOk()) return ok(undefined);

  const guest = await apiFetch<{ playerId: string }>("/api/auth/guest", {
    method: "POST",
  });
  return guest.map(() => undefined);
}
