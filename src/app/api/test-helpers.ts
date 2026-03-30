import { ok, err } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";

export function createRoutedApiFetch(
  routes: Record<string, unknown>,
): <T>(path: string, init?: RequestInit) => Promise<Result<T, InfraError>> {
  return async <T>(path: string): Promise<Result<T, InfraError>> => {
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return err({ type: "API_FETCH_FAILED", status: 404, cause: null });
    const response = routes[key];
    if (response instanceof Error) {
      return err({ type: "API_FETCH_FAILED", status: 500, cause: response });
    }
    return ok(response as T);
  };
}
