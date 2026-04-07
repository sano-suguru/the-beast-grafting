vi.mock("../../shared/logger", () => ({
  warn: vi.fn(),
}));

import {
  initAuth,
  logoutAction,
  loginWithProvider,
  renameAction,
  authErrorMessage,
  resetAuthModuleState,
} from "./auth-actions";
import { ensureSession } from "../api/fetch";
import {
  playerDisplayName,
  playerProviders,
  showAccountOverlay,
  authError,
  authInitFailed,
  editingName,
} from "./auth-store";
import { resetAllSignals } from "./game-store";
import { stubFetch, httpError, stubSessionRecovery } from "./test-helpers";

const DEFAULT_ME = { playerId: "p1", displayName: "Tester", providers: ["discord"] };
const DEFAULT_GUEST = { playerId: "g1", displayName: "Guest#1234" };

function meHandler(me: typeof DEFAULT_ME | null | undefined, meError?: number) {
  if (meError) return httpError(meError);
  if (me === null) return httpError(401);
  return me ?? DEFAULT_ME;
}

function guestHandler(guest: typeof DEFAULT_GUEST | null | undefined, guestError?: number) {
  if (guestError) return httpError(guestError);
  if (guest === null) return httpError(500);
  return guest ?? DEFAULT_GUEST;
}

interface AuthRouteOpts {
  me?: typeof DEFAULT_ME | null;
  guest?: typeof DEFAULT_GUEST | null;
  meError?: number;
  guestError?: number;
  logoutOk?: boolean;
}

function authRoutes(opts: AuthRouteOpts = {}) {
  const routes: Record<string, (init?: RequestInit) => unknown> = {
    "/api/auth/me": () => meHandler(opts.me, opts.meError),
    "/api/auth/guest": (init) =>
      init?.method === "POST" ? guestHandler(opts.guest, opts.guestError) : undefined,
    "/api/auth/logout": (init) => {
      if (init?.method !== "POST") return undefined;
      return opts.logoutOk === false ? httpError(500) : { ok: true };
    },
  };
  return (url: string, init?: RequestInit) => routes[url]?.(init);
}

let replaceStateSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetAllSignals();
  resetAuthModuleState();
  playerDisplayName.value = null;
  playerProviders.value = [];
  showAccountOverlay.value = false;
  authError.value = null;
  authInitFailed.value = false;
  editingName.value = false;
  stubSessionRecovery();
  vi.restoreAllMocks();

  vi.stubGlobal("location", {
    search: "",
    pathname: "/",
    href: "/",
  });
  replaceStateSpy = vi.fn();
  vi.stubGlobal("history", { replaceState: replaceStateSpy });
});

describe("initAuth", () => {
  it("sets signals from fetchMe on success", async () => {
    stubFetch(authRoutes({ me: { playerId: "p1", displayName: "Alice", providers: ["google"] } }));

    initAuth();
    await ensureSession();

    expect(playerDisplayName.value).toBe("Alice");
    expect(playerProviders.value).toEqual(["google"]);
    expect(authInitFailed.value).toBe(false);
  });

  it("falls back to guest when fetchMe fails", async () => {
    stubFetch(authRoutes({ me: null, guest: { playerId: "g1", displayName: "Guest#42" } }));

    initAuth();
    await ensureSession();

    expect(playerDisplayName.value).toBe("Guest#42");
    expect(playerProviders.value).toEqual([]);
    expect(authInitFailed.value).toBe(false);
  });

  it("sets authInitFailed when both fail", async () => {
    stubFetch(authRoutes({ me: null, guest: null }));

    initAuth();
    const result = await ensureSession();

    expect(result.isErr()).toBe(true);
    expect(authInitFailed.value).toBe(true);
    expect(playerDisplayName.value).toBeNull();
  });

  it("reads auth_error from URL params and opens overlay after session recovery", async () => {
    vi.stubGlobal("location", {
      search: "?auth_error=oauth_failed",
      pathname: "/",
      href: "/?auth_error=oauth_failed",
    });
    stubFetch(authRoutes());

    initAuth();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/");

    expect(authError.value).toBeNull();
    expect(showAccountOverlay.value).toBe(false);

    await ensureSession();

    expect(authError.value).toBe("oauth_failed");
    expect(showAccountOverlay.value).toBe(true);
  });

  it("handles email-only provider in providers array", async () => {
    stubFetch(authRoutes({ me: { playerId: "p1", displayName: "Alice", providers: ["email"] } }));

    initAuth();
    await ensureSession();

    expect(playerProviders.value).toEqual(["email"]);
    expect(playerDisplayName.value).toBe("Alice");
  });

  it("does not open overlay when no auth_error", async () => {
    stubFetch(authRoutes());

    initAuth();
    await ensureSession();

    expect(authError.value).toBeNull();
    expect(showAccountOverlay.value).toBe(false);
  });

  it("opens name editing overlay for logged-in user with guest name", async () => {
    stubFetch(
      authRoutes({
        me: { playerId: "p1", displayName: "名もなき術師#ABCD", providers: ["google"] },
      }),
    );

    initAuth();
    await ensureSession();

    expect(showAccountOverlay.value).toBe(true);
    expect(editingName.value).toBe(true);
  });

  it("does not open name editing for logged-in user with custom name", async () => {
    stubFetch(
      authRoutes({
        me: { playerId: "p1", displayName: "術師太郎", providers: ["google"] },
      }),
    );

    initAuth();
    await ensureSession();

    expect(showAccountOverlay.value).toBe(false);
    expect(editingName.value).toBe(false);
  });

  it("does not open name editing for guest", async () => {
    stubFetch(authRoutes({ me: null }));

    initAuth();
    await ensureSession();

    expect(showAccountOverlay.value).toBe(false);
    expect(editingName.value).toBe(false);
  });

  it("clears session cache on init failure so retry works", async () => {
    stubFetch(authRoutes({ me: null, guest: null }));
    initAuth();
    const r1 = await ensureSession();
    expect(r1.isErr()).toBe(true);

    stubFetch(authRoutes({ me: { playerId: "p1", displayName: "Recovered", providers: [] } }));
    const r2 = await ensureSession();
    expect(r2.isOk()).toBe(true);
    expect(playerDisplayName.value).toBe("Recovered");
  });

  it("does not duplicate API calls when ensureSession is called concurrently", async () => {
    const spy = stubFetch(authRoutes());

    initAuth();
    const [r1, r2] = await Promise.all([ensureSession(), ensureSession()]);

    expect(r1.isOk()).toBe(true);
    expect(r2.isOk()).toBe(true);
    const meCalls = spy.mock.calls.filter(
      (c: [string | URL | Request, ...unknown[]]) =>
        (typeof c[0] === "string" ? c[0] : "") === "/api/auth/me",
    );
    expect(meCalls).toHaveLength(1);
  });
});

describe("logoutAction", () => {
  it("resets signals and re-creates guest", async () => {
    stubFetch(authRoutes({ logoutOk: true, guest: { playerId: "g2", displayName: "Guest#99" } }));
    playerDisplayName.value = "Alice";
    playerProviders.value = ["discord"];
    showAccountOverlay.value = true;
    authError.value = "stale_error";
    authInitFailed.value = true;
    editingName.value = true;

    await logoutAction();

    expect(playerDisplayName.value).toBe("Guest#99");
    expect(playerProviders.value).toEqual([]);
    expect(showAccountOverlay.value).toBe(false);
    expect(authError.value).toBeNull();
    expect(authInitFailed.value).toBe(false);
    expect(editingName.value).toBe(false);
  });

  it("sets authError on logout API failure", async () => {
    stubFetch(authRoutes({ logoutOk: false }));
    playerDisplayName.value = "Alice";

    await logoutAction();

    expect(playerDisplayName.value).toBe("Alice");
    expect(authError.value).toBe("logout_failed");
  });

  it("clears pendingAuthError so it does not surface after re-init", async () => {
    vi.stubGlobal("location", {
      search: "?auth_error=oauth_failed",
      pathname: "/",
      href: "/?auth_error=oauth_failed",
    });
    stubFetch(authRoutes({ logoutOk: true }));
    initAuth();

    await logoutAction();

    vi.stubGlobal("location", { search: "", pathname: "/", href: "/" });
    stubFetch(authRoutes());
    initAuth();
    await ensureSession();

    expect(authError.value).toBeNull();
    expect(showAccountOverlay.value).toBe(false);
  });
});

describe("loginWithProvider", () => {
  it("redirects to provider auth URL", () => {
    const loc = { href: "/" };
    vi.stubGlobal("location", loc);

    loginWithProvider("discord");
    expect(loc.href).toBe("/api/auth/discord");
  });
});

describe("authErrorMessage", () => {
  it("returns known message", () => {
    expect(authErrorMessage("oauth_failed")).toBe("認証に失敗しました。再度お試しください。");
  });

  it("returns fallback for unknown code", () => {
    expect(authErrorMessage("unknown")).toBe("認証エラーが発生しました。(unknown)");
  });
});

describe("renameAction", () => {
  it("updates playerDisplayName on success", async () => {
    stubFetch((url: string, init?: RequestInit) => {
      if (url === "/api/auth/name" && init?.method === "PATCH") return { displayName: "術師太郎" };
      return authRoutes()(url, init);
    });
    playerDisplayName.value = "名もなき術師#ABCD";

    const result = await renameAction("術師太郎");

    expect(result.isOk()).toBe(true);
    expect(playerDisplayName.value).toBe("術師太郎");
  });

  it("sets authError on failure", async () => {
    stubFetch((url: string, init?: RequestInit) => {
      if (url === "/api/auth/name" && init?.method === "PATCH") return httpError(500);
      return authRoutes()(url, init);
    });
    playerDisplayName.value = "名もなき術師#ABCD";

    const result = await renameAction("new name");

    expect(result.isErr()).toBe(true);
    expect(playerDisplayName.value).toBe("名もなき術師#ABCD");
    expect(authError.value).toBe("rename_failed");
  });
});
