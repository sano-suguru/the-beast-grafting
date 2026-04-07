import { batch } from "@preact/signals";
import type { OAuthProvider } from "../../shared/auth-provider";
import { ok, err } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { fetchMe, createGuest, logout, updateDisplayName } from "../api/auth-client";
import { initSession, setSessionPromise } from "../api/fetch";
import { resetAllSignals } from "./game-store";
import {
  playerDisplayName,
  playerProviders,
  showAccountOverlay,
  authError,
  authLoading,
  authInitFailed,
  editingName,
} from "./auth-store";
import { GUEST_NAME_PREFIX } from "../../shared/guest-name";
import { warn } from "../../shared/logger";

let pendingAuthError: string | null = null;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "認証に失敗しました。再度お試しください。",
  invalid_state: "認証の検証に失敗しました。再度お試しください。",
  internal_error: "サーバーエラーが発生しました。",
  provider_not_configured: "この認証プロバイダは現在利用できません。",
  logout_failed: "ログアウトに失敗しました。再度お試しください。",
  re_guest_failed: "セッションの再作成に失敗しました。ページを再読み込みしてください。",
  rename_failed: "名前の変更に失敗しました。",
};

export function authErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? `認証エラーが発生しました。(${code})`;
}

function consumePendingAuthError() {
  if (pendingAuthError) {
    authError.value = pendingAuthError;
    showAccountOverlay.value = true;
    pendingAuthError = null;
  }
}

export function resetAuthModuleState(): void {
  pendingAuthError = null;
}

async function recoverSession(): Promise<Result<void, InfraError>> {
  const me = await fetchMe();
  if (me.isOk()) {
    const needsName =
      me.value.providers.length > 0 && me.value.displayName.startsWith(GUEST_NAME_PREFIX);
    batch(() => {
      playerDisplayName.value = me.value.displayName;
      playerProviders.value = me.value.providers;
      authLoading.value = false;
      consumePendingAuthError();
      if (needsName) {
        showAccountOverlay.value = true;
        editingName.value = true;
      }
    });
    return ok(undefined);
  }

  const guest = await createGuest();
  if (guest.isOk()) {
    batch(() => {
      playerDisplayName.value = guest.value.displayName;
      playerProviders.value = [];
      authLoading.value = false;
      consumePendingAuthError();
    });
    return ok(undefined);
  }

  batch(() => {
    authInitFailed.value = true;
    authLoading.value = false;
    consumePendingAuthError();
  });
  warn("[auth:recoverSession]", guest.error);
  return err(guest.error);
}

export function initAuth(): void {
  const params = new URLSearchParams(globalThis.location.search);
  const errorCode = params.get("auth_error");
  if (errorCode) {
    pendingAuthError = errorCode;
    globalThis.history.replaceState(null, "", globalThis.location.pathname);
  }

  initSession(recoverSession);
}

export function loginWithProvider(provider: OAuthProvider): void {
  globalThis.location.href = `/api/auth/${provider}`;
}

export async function logoutAction(): Promise<void> {
  const result = await logout();
  if (result.isErr()) {
    warn("[auth:logout]", result.error);
    authError.value = "logout_failed";
    return;
  }

  batch(() => {
    playerDisplayName.value = null;
    playerProviders.value = [];
    showAccountOverlay.value = false;
    authError.value = null;
    authInitFailed.value = false;
    editingName.value = false;
  });
  pendingAuthError = null;
  resetAllSignals();

  const guestPromise = (async (): Promise<Result<void, InfraError>> => {
    const guest = await createGuest();
    if (guest.isOk()) {
      playerDisplayName.value = guest.value.displayName;
      return ok(undefined);
    }
    warn("[auth:logout:re-guest]", guest.error);
    return err(guest.error);
  })();

  setSessionPromise(guestPromise);
  const guestResult = await guestPromise;
  if (guestResult.isErr()) {
    authError.value = "re_guest_failed";
  }
}

export async function renameAction(name: string): Promise<Result<void, InfraError>> {
  const result = await updateDisplayName(name);
  if (result.isErr()) {
    warn("[auth:rename]", result.error);
    authError.value = "rename_failed";
    return err(result.error);
  }
  playerDisplayName.value = result.value.displayName;
  return ok(undefined);
}
