import { ok, err, safeAsync } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
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
    const body = await safeAsync(() => response.json(), apiFetchErr(response.status));
    return err({
      type: "API_FETCH_FAILED",
      status: response.status,
      cause: body.isOk() ? body.value : null,
    });
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
let sessionRecoveryFn: (() => Promise<Result<void, InfraError>>) | null = null;

/**
 * セッション回復関数を登録し、即座に初回実行する。
 * アプリ起動時に1回だけ呼ぶこと（main.tsx → initAuth → initSession）。
 */
export function initSession(fn: () => Promise<Result<void, InfraError>>): void {
  sessionRecoveryFn = fn;
  const p = fn();
  sessionPromise = p;
  void p.then((result) => {
    if (result.isErr() && sessionPromise === p) sessionPromise = null;
  });
}

/**
 * セッションが確立済みならキャッシュされたPromiseを返す。
 * 未確立or失敗済みならrecoveryFnを再実行して新しいPromiseを返す。
 */
export async function ensureSession(): Promise<Result<void, InfraError>> {
  if (sessionPromise) return sessionPromise;
  invariant(sessionRecoveryFn, "ensureSession called before initAuth");
  sessionPromise = sessionRecoveryFn();
  const result = await sessionPromise;
  if (result.isErr()) sessionPromise = null;
  return result;
}

/**
 * 外部で作成したセッションPromiseを注入する。
 * logoutAction後のゲスト再作成など、recoveryFn以外のフローで使う。
 */
export function setSessionPromise(p: Promise<Result<void, InfraError>>): void {
  sessionPromise = p;
}
