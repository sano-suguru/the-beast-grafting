import { buildAuthorizeUrl, exchangeCode, fetchUserInfo, findOrCreateByProvider } from "./oauth";
import { createTestDb } from "./test-db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { players } from "../../db/schema";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe("buildAuthorizeUrl", () => {
  const creds = { clientId: "id", clientSecret: "secret" };

  it("builds Discord authorize URL", () => {
    const url = buildAuthorizeUrl("discord", creds, "http://localhost/cb", "state123");
    expect(url).toContain("discord.com/oauth2/authorize");
    expect(url).toContain("client_id=id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state123");
    expect(url).toContain("scope=identify+email");
  });

  it("builds Google authorize URL", () => {
    const url = buildAuthorizeUrl("google", creds, "http://localhost/cb", "state456");
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("scope=openid+email+profile");
  });
});

describe("exchangeCode", () => {
  const creds = { clientId: "id", clientSecret: "secret" };

  it("returns access_token on success", async () => {
    mockFetch(200, { access_token: "tok-123", token_type: "Bearer" });
    const result = await exchangeCode("discord", "code", creds, "http://localhost/cb");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("tok-123");
  });

  it("returns Err on non-ok response", async () => {
    mockFetch(400, { error: "invalid_grant" });
    const result = await exchangeCode("discord", "bad-code", creds, "http://localhost/cb");
    expect(result.isErr()).toBe(true);
  });
});

describe("fetchUserInfo", () => {
  it("extracts Discord user info with global_name", async () => {
    mockFetch(200, { id: "123", global_name: "Alice", username: "alice" });
    const result = await fetchUserInfo("discord", "token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.providerId).toBe("123");
      expect(result.value.displayName).toBe("Alice");
    }
  });

  it("falls back to username when global_name is null", async () => {
    mockFetch(200, { id: "456", global_name: null, username: "bob" });
    const result = await fetchUserInfo("discord", "token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.displayName).toBe("bob");
  });

  it("extracts Google user info with sub field", async () => {
    mockFetch(200, { sub: "g-789", name: "Carol" });
    const result = await fetchUserInfo("google", "token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.providerId).toBe("g-789");
      expect(result.value.displayName).toBe("Carol");
    }
  });

  it("returns Err when Google response lacks sub", async () => {
    mockFetch(200, { id: "g-legacy", name: "Legacy" });
    const result = await fetchUserInfo("google", "token");
    expect(result.isErr()).toBe(true);
  });

  it("returns Err when provider returns no user ID", async () => {
    mockFetch(200, { name: "NoId" });
    const result = await fetchUserInfo("discord", "token");
    expect(result.isErr()).toBe(true);
  });

  it("returns Err on non-ok response", async () => {
    mockFetch(401, { error: "unauthorized" });
    const result = await fetchUserInfo("discord", "token");
    expect(result.isErr()).toBe(true);
  });
});

describe("findOrCreateByProvider", () => {
  let db: DrizzleD1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  const userInfo = { providerId: "ext-1", displayName: "OAuthUser" };

  it("creates new player when no existing account", async () => {
    const result = await findOrCreateByProvider(db, "discord", userInfo, null);
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.isNew).toBe(true);
    expect(result.value.playerId).toBeTruthy();
  });

  it("returns existing player when provider already linked", async () => {
    const first = await findOrCreateByProvider(db, "discord", userInfo, null);
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = await findOrCreateByProvider(db, "discord", userInfo, null);
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.isNew).toBe(false);
    expect(second.value.playerId).toBe(first.value.playerId);
  });

  it("links to existing player when existingPlayerId provided", async () => {
    const now = new Date();
    const existingId = "existing-player";
    await db
      .insert(players)
      .values({ id: existingId, displayName: "名もなき術師#ABCD", createdAt: now, updatedAt: now });

    const result = await findOrCreateByProvider(db, "google", userInfo, existingId);
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.playerId).toBe(existingId);
    expect(result.value.isNew).toBe(false);
  });

  it("creates new player when existingPlayerId is not in DB", async () => {
    const result = await findOrCreateByProvider(db, "discord", userInfo, "nonexistent-id");
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.isNew).toBe(true);
    expect(result.value.playerId).not.toBe("nonexistent-id");
  });

  it("returns existing provider player when already linked with different existingPlayerId", async () => {
    const first = await findOrCreateByProvider(db, "discord", userInfo, null);
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const now = new Date();
    const otherId = "other-player";
    await db
      .insert(players)
      .values({ id: otherId, displayName: "Other", createdAt: now, updatedAt: now });

    const second = await findOrCreateByProvider(db, "discord", userInfo, otherId);
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.playerId).toBe(first.value.playerId);
    expect(second.value.isNew).toBe(false);
  });

  it("preserves non-guest display name when linking", async () => {
    const now = new Date();
    const registeredId = "registered-player";
    await db.insert(players).values({
      id: registeredId,
      displayName: "CustomName",
      createdAt: now,
      updatedAt: now,
    });

    await findOrCreateByProvider(db, "discord", userInfo, registeredId);

    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ displayName: players.displayName })
      .from(players)
      .where(eq(players.id, registeredId));
    expect(rows[0]?.displayName).toBe("CustomName");
  });

  it("updates guest display name when linking", async () => {
    const now = new Date();
    const guestId = "guest-player";
    await db
      .insert(players)
      .values({ id: guestId, displayName: "名もなき術師#1234", createdAt: now, updatedAt: now });

    await findOrCreateByProvider(db, "discord", userInfo, guestId);

    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ displayName: players.displayName })
      .from(players)
      .where(eq(players.id, guestId));
    expect(rows[0]?.displayName).toBe("OAuthUser");
  });
});
