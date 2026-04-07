import { createTestDb } from "./test-db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { sessions } from "../../db/schema";
import auth from "./routes";
import {
  createAuthTestApp,
  post,
  patch,
  get,
  extractSessionCookie,
  extractCookie,
  TEST_ENV,
} from "./test-helpers";
import type { AppEnv } from "./types";
import { Hono } from "hono";

let testDb: DrizzleD1Database;
let testApp: Hono<AppEnv>;

beforeEach(() => {
  testDb = createTestDb();
  testApp = createAuthTestApp(() => testDb, auth);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function initiateOAuth(provider: string) {
  const res = await get(testApp, `/${provider}`);
  expect(res.status).toBe(302);
  const location = res.headers.get("location") ?? "";
  const url = new URL(location);
  const state = url.searchParams.get("state") ?? "";
  const stateCookie = extractCookie(res, `oauth_state_${provider}`);
  return { state, stateCookie };
}

type MockResponse = { status: number; body: unknown };

function mockOAuthFetch(tokenResponse: MockResponse, userInfoResponse: MockResponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: string | URL | Request) => {
      let url: string;
      if (typeof input === "string") url = input;
      else if (input instanceof URL) url = input.href;
      else url = input.url;
      const res = url.includes("/token") ? tokenResponse : userInfoResponse;
      return Promise.resolve(new Response(JSON.stringify(res.body), { status: res.status }));
    }),
  );
}

describe("auth routes -- integration", () => {
  it("POST /guest creates player and issues session cookie", async () => {
    const res = await post(testApp, "/guest");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string; displayName: string };
    expect(body.playerId).toBeDefined();
    expect(body.displayName).toMatch(/^名もなき術師#/);
    expect(extractSessionCookie(res)).not.toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("POST /register creates player + auth_provider and issues session", async () => {
    const res = await post(testApp, "/register", {
      email: "test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string; displayName: string };
    expect(body.playerId).toBeDefined();
    expect(body.displayName).toMatch(/^名もなき術師#/);
    expect(extractSessionCookie(res)).not.toBe("");
  });

  it("POST /login succeeds with correct credentials", async () => {
    await post(testApp, "/register", { email: "login@example.com", password: "password123" });
    const res = await post(testApp, "/login", {
      email: "login@example.com",
      password: "password123",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string };
    expect(body.playerId).toBeDefined();
    expect(extractSessionCookie(res)).not.toBe("");
  });

  it("POST /login rejects wrong password", async () => {
    await post(testApp, "/register", { email: "wrong@example.com", password: "password123" });
    const res = await post(testApp, "/login", {
      email: "wrong@example.com",
      password: "badpassword",
    });
    expect(res.status).toBe(401);
  });

  it("POST /register rejects duplicate email", async () => {
    await post(testApp, "/register", { email: "dup@example.com", password: "password123" });
    const res = await post(testApp, "/register", {
      email: "dup@example.com",
      password: "password456",
    });
    expect(res.status).toBe(409);
  });

  it("GET /me returns player info with valid session", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);
    const guestBody = (await guestRes.json()) as { playerId: string };

    const meRes = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as {
      playerId: string;
      displayName: string;
      providers: string[];
    };
    expect(meBody.playerId).toBe(guestBody.playerId);
    expect(meBody.providers).toEqual([]);
  });

  it("GET /me includes email in providers after register", async () => {
    const regRes = await post(testApp, "/register", {
      email: "me-test@example.com",
      password: "password123",
    });
    const cookie = extractSessionCookie(regRes);

    const meRes = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { providers: string[] };
    expect(meBody.providers).toContain("email");
  });

  it("POST /logout invalidates session", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);

    const logoutRes = await post(testApp, "/logout", undefined, {
      Cookie: `session=${cookie}`,
    });
    expect(logoutRes.status).toBe(200);

    const meRes = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    expect(meRes.status).toBe(401);
  });

  it("guest -> register upgrade preserves playerId", async () => {
    const guestRes = await post(testApp, "/guest");
    const guestBody = (await guestRes.json()) as { playerId: string };
    const cookie = extractSessionCookie(guestRes);

    const registerRes = await post(
      testApp,
      "/register",
      { email: "upgrade@example.com", password: "password123" },
      { Cookie: `session=${cookie}` },
    );
    expect(registerRes.status).toBe(200);
    const registerBody = (await registerRes.json()) as { playerId: string };
    expect(registerBody.playerId).toBe(guestBody.playerId);
  });

  it("POST /login with non-existent email returns 401", async () => {
    const res = await post(testApp, "/login", {
      email: "noone@example.com",
      password: "password123",
    });
    expect(res.status).toBe(401);
  });

  it("GET /me displayName is guest name after register", async () => {
    const regRes = await post(testApp, "/register", {
      email: "alice@example.com",
      password: "password123",
    });
    const cookie = extractSessionCookie(regRes);

    const meRes = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { displayName: string };
    expect(meBody.displayName).toMatch(/^名もなき術師#/);
  });

  it("PATCH /name updates display name", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);

    const renameRes = await patch(
      testApp,
      "/name",
      { displayName: "術師太郎" },
      { Cookie: `session=${cookie}` },
    );
    expect(renameRes.status).toBe(200);
    const renameBody = (await renameRes.json()) as { displayName: string };
    expect(renameBody.displayName).toBe("術師太郎");

    const meRes = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    const meBody = (await meRes.json()) as { displayName: string };
    expect(meBody.displayName).toBe("術師太郎");
  });

  it("PATCH /name requires authentication", async () => {
    const res = await patch(testApp, "/name", { displayName: "test" });
    expect(res.status).toBe(401);
  });

  it("PATCH /name rejects empty name", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);

    const res = await patch(testApp, "/name", { displayName: "" }, { Cookie: `session=${cookie}` });
    expect(res.status).toBe(400);
  });

  it("PATCH /name returns 429 after rate limit exceeded", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);

    for (let i = 0; i < 5; i++) {
      await patch(testApp, "/name", { displayName: `name${i}` }, { Cookie: `session=${cookie}` });
    }
    const res = await patch(
      testApp,
      "/name",
      { displayName: "overflow" },
      { Cookie: `session=${cookie}` },
    );
    expect(res.status).toBe(429);
  });

  it("full lifecycle: guest -> register -> logout -> login preserves playerId", async () => {
    const guestRes = await post(testApp, "/guest");
    const guestBody = (await guestRes.json()) as { playerId: string };
    const guestCookie = extractSessionCookie(guestRes);

    const regRes = await post(
      testApp,
      "/register",
      { email: "lifecycle@example.com", password: "password123" },
      { Cookie: `session=${guestCookie}` },
    );
    expect(regRes.status).toBe(200);
    const regBody = (await regRes.json()) as { playerId: string };
    expect(regBody.playerId).toBe(guestBody.playerId);

    const regCookie = extractSessionCookie(regRes);
    const logoutRes = await post(testApp, "/logout", undefined, {
      Cookie: `session=${regCookie}`,
    });
    expect(logoutRes.status).toBe(200);

    const loginRes = await post(testApp, "/login", {
      email: "lifecycle@example.com",
      password: "password123",
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { playerId: string };
    expect(loginBody.playerId).toBe(guestBody.playerId);
  });

  it("expired session returns 401 on GET /me", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);

    await testDb.update(sessions).set({ expiresAt: new Date(0) });

    const meRes = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    expect(meRes.status).toBe(401);
  });

  it("GET /me works with Bearer token", async () => {
    const guestRes = await post(testApp, "/guest");
    const token = extractSessionCookie(guestRes);
    const guestBody = (await guestRes.json()) as { playerId: string };

    const meRes = await get(testApp, "/me", { Authorization: `Bearer ${token}` });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { playerId: string };
    expect(meBody.playerId).toBe(guestBody.playerId);
  });
});

describe("OAuth callback -- integration", () => {
  it("complete OAuth flow creates player and sets session cookie", async () => {
    const { state, stateCookie } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-1", token_type: "Bearer" } },
      { status: 200, body: { id: "discord-123", global_name: "TestUser", username: "testuser" } },
    );

    const cbRes = await get(testApp, `/discord/callback?code=test-code&state=${state}`, {
      Cookie: `oauth_state_discord=${stateCookie}`,
    });

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("cache-control")).toBe("no-store");
    expect(cbRes.headers.get("location")).toBe(TEST_ENV.ALLOWED_ORIGIN);
    expect(extractSessionCookie(cbRes)).not.toBe("");
  });

  it("OAuth links to existing guest player", async () => {
    const guestRes = await post(testApp, "/guest");
    const guestBody = (await guestRes.json()) as { playerId: string };
    const guestCookie = extractSessionCookie(guestRes);

    const { state, stateCookie } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-2", token_type: "Bearer" } },
      { status: 200, body: { id: "discord-456", global_name: "LinkedUser", username: "linked" } },
    );

    const cbRes = await get(testApp, `/discord/callback?code=test-code&state=${state}`, {
      Cookie: `oauth_state_discord=${stateCookie}; session=${guestCookie}`,
    });

    expect(cbRes.status).toBe(302);
    const sessionToken = extractSessionCookie(cbRes);

    const meRes = await get(testApp, "/me", { Cookie: `session=${sessionToken}` });
    const meBody = (await meRes.json()) as { playerId: string; providers: string[] };
    expect(meBody.playerId).toBe(guestBody.playerId);
    expect(meBody.providers).toContain("discord");
  });

  it("same provider re-login returns existing playerId", async () => {
    const { state: s1, stateCookie: sc1 } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-re1", token_type: "Bearer" } },
      { status: 200, body: { id: "discord-same", global_name: "SameUser", username: "same" } },
    );
    const cb1 = await get(testApp, `/discord/callback?code=code1&state=${s1}`, {
      Cookie: `oauth_state_discord=${sc1}`,
    });
    const session1 = extractSessionCookie(cb1);
    const me1 = await get(testApp, "/me", { Cookie: `session=${session1}` });
    const me1Body = (await me1.json()) as { playerId: string };

    const { state: s2, stateCookie: sc2 } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-re2", token_type: "Bearer" } },
      { status: 200, body: { id: "discord-same", global_name: "SameUser", username: "same" } },
    );
    const cb2 = await get(testApp, `/discord/callback?code=code2&state=${s2}`, {
      Cookie: `oauth_state_discord=${sc2}`,
    });
    const session2 = extractSessionCookie(cb2);
    const me2 = await get(testApp, "/me", { Cookie: `session=${session2}` });
    const me2Body = (await me2.json()) as { playerId: string };

    expect(me2Body.playerId).toBe(me1Body.playerId);
  });

  it("multiple providers linked, /me shows both", async () => {
    const guestRes = await post(testApp, "/guest");
    const guestBody = (await guestRes.json()) as { playerId: string };
    const guestCookie = extractSessionCookie(guestRes);

    const { state: ds, stateCookie: dsc } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-d", token_type: "Bearer" } },
      { status: 200, body: { id: "d-multi", global_name: "Multi", username: "multi" } },
    );
    const dcb = await get(testApp, `/discord/callback?code=c1&state=${ds}`, {
      Cookie: `oauth_state_discord=${dsc}; session=${guestCookie}`,
    });
    const discordSession = extractSessionCookie(dcb);

    const { state: gs, stateCookie: gsc } = await initiateOAuth("google");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-g", token_type: "Bearer" } },
      { status: 200, body: { sub: "g-multi", name: "MultiGoogle" } },
    );
    const gcb = await get(testApp, `/google/callback?code=c2&state=${gs}`, {
      Cookie: `oauth_state_google=${gsc}; session=${discordSession}`,
    });
    const googleSession = extractSessionCookie(gcb);

    const meRes = await get(testApp, "/me", { Cookie: `session=${googleSession}` });
    const meBody = (await meRes.json()) as {
      playerId: string;
      providers: string[];
    };
    expect(meBody.playerId).toBe(guestBody.playerId);
    expect(meBody.providers).toContain("discord");
    expect(meBody.providers).toContain("google");
  });

  it("linking OAuth does not change displayName", async () => {
    const regRes = await post(testApp, "/register", {
      email: "keep-name@example.com",
      password: "password123",
    });
    const regCookie = extractSessionCookie(regRes);
    const regBody = (await regRes.json()) as { displayName: string };
    const originalName = regBody.displayName;

    const { state, stateCookie } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-keep", token_type: "Bearer" } },
      { status: 200, body: { id: "d-keep" } },
    );
    const cbRes = await get(testApp, `/discord/callback?code=c&state=${state}`, {
      Cookie: `oauth_state_discord=${stateCookie}; session=${regCookie}`,
    });
    const newSession = extractSessionCookie(cbRes);

    const meRes = await get(testApp, "/me", { Cookie: `session=${newSession}` });
    const meBody = (await meRes.json()) as { displayName: string };
    expect(meBody.displayName).toBe(originalName);
  });

  it("invalid state cookie redirects with auth_error", async () => {
    const cbRes = await get(testApp, "/discord/callback?code=test-code&state=fake-state", {
      Cookie: "oauth_state_discord=tampered-cookie",
    });

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("cache-control")).toBe("no-store");
    const location = cbRes.headers.get("location") ?? "";
    expect(location).toContain("auth_error=invalid_state");
  });

  it("missing state params redirects with auth_error", async () => {
    const cbRes = await get(testApp, "/discord/callback");
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("cache-control")).toBe("no-store");
    expect(cbRes.headers.get("location")).toContain("auth_error=invalid_state");
  });

  it("token exchange failure redirects with auth_error", async () => {
    const { state, stateCookie } = await initiateOAuth("discord");
    mockOAuthFetch({ status: 400, body: { error: "invalid_grant" } }, { status: 200, body: {} });

    const cbRes = await get(testApp, `/discord/callback?code=bad-code&state=${state}`, {
      Cookie: `oauth_state_discord=${stateCookie}`,
    });

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("cache-control")).toBe("no-store");
    expect(cbRes.headers.get("location")).toContain("auth_error=oauth_failed");
  });

  it("user info failure redirects with auth_error", async () => {
    const { state, stateCookie } = await initiateOAuth("discord");
    mockOAuthFetch(
      { status: 200, body: { access_token: "tok-3", token_type: "Bearer" } },
      { status: 401, body: { error: "unauthorized" } },
    );

    const cbRes = await get(testApp, `/discord/callback?code=test-code&state=${state}`, {
      Cookie: `oauth_state_discord=${stateCookie}`,
    });

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("cache-control")).toBe("no-store");
    expect(cbRes.headers.get("location")).toContain("auth_error=oauth_failed");
  });
});

describe("OAuth credentials not configured", () => {
  let unconfiguredApp: Hono<AppEnv>;

  beforeEach(() => {
    const envWithoutCreds = {
      ...TEST_ENV,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      DISCORD_CLIENT_ID: "",
      DISCORD_CLIENT_SECRET: "",
    } as Env;
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", testDb);
      await next();
    });
    app.route("/", auth);
    unconfiguredApp = app;

    // Override request to use envWithoutCreds
    const origRequest = unconfiguredApp.request.bind(unconfiguredApp);
    unconfiguredApp.request = ((path: string, init?: RequestInit) =>
      origRequest(path, init, envWithoutCreds)) as typeof unconfiguredApp.request;
  });

  it("GET /google redirects with provider_not_configured when credentials missing", async () => {
    const res = await unconfiguredApp.request("/google");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("auth_error=provider_not_configured");
  });

  it("GET /discord redirects with provider_not_configured when credentials missing", async () => {
    const res = await unconfiguredApp.request("/discord");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("auth_error=provider_not_configured");
  });

  it("callback also returns provider_not_configured when credentials missing", async () => {
    const res = await unconfiguredApp.request("/google/callback?code=test&state=test", {
      headers: { Cookie: "oauth_state_google=fake" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("auth_error=");
  });
});

describe("Google OAuth callback -- integration", () => {
  it("complete Google OAuth flow creates player with sub field as providerId", async () => {
    const { state, stateCookie } = await initiateOAuth("google");
    mockOAuthFetch(
      { status: 200, body: { access_token: "g-tok-1", token_type: "Bearer" } },
      { status: 200, body: { sub: "google-123", name: "GoogleUser" } },
    );

    const cbRes = await get(testApp, `/google/callback?code=g-code&state=${state}`, {
      Cookie: `oauth_state_google=${stateCookie}`,
    });

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("location")).toBe(TEST_ENV.ALLOWED_ORIGIN);
    const session = extractSessionCookie(cbRes);
    expect(session).not.toBe("");

    const meRes = await get(testApp, "/me", { Cookie: `session=${session}` });
    const meBody = (await meRes.json()) as {
      displayName: string;
      providers: string[];
    };
    expect(meBody.displayName).toMatch(/^名もなき術師#/);
    expect(meBody.providers).toContain("google");
  });
});

describe("CSRF guard", () => {
  it("POST without Origin returns 403", async () => {
    const res = await testApp.request("/guest", { method: "POST" }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("POST with wrong Origin returns 403", async () => {
    const res = await testApp.request(
      "/guest",
      { method: "POST", headers: { Origin: "https://evil.example.com" } },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("GET without Origin passes", async () => {
    const guestRes = await post(testApp, "/guest");
    const cookie = extractSessionCookie(guestRes);
    const res = await get(testApp, "/me", { Cookie: `session=${cookie}` });
    expect(res.status).toBe(200);
  });
});
