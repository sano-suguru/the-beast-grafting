import { getTestDb, type TestDb } from "../test-db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import auth from "./routes";
import {
  createAuthTestApp,
  post,
  patch,
  get,
  extractSessionCookie,
  TEST_ENV,
} from "./test-helpers";

let testEnv: TestDb;
let testDb: DrizzleD1Database;

beforeAll(async () => {
  testEnv = await getTestDb();
  testDb = testEnv.db;
});

beforeEach(async () => {
  await testEnv.clean();
});

function app() {
  return createAuthTestApp(() => testDb, auth);
}

describe("input validation", () => {
  it("POST /register rejects missing email", async () => {
    const res = await post(app(), "/register", { password: "12345678" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string; reason: string } };
    expect(body.error.reason).toBe("email_must_be_string");
  });

  it("POST /register rejects invalid email", async () => {
    const res = await post(app(), "/register", { email: "bad", password: "12345678" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string; reason: string } };
    expect(body.error.reason).toBe("invalid_email_format");
  });

  it("POST /register rejects short password", async () => {
    const res = await post(app(), "/register", { email: "a@b.com", password: "short" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string; reason: string } };
    expect(body.error.reason).toBe("password_too_short");
  });

  it("POST /register rejects password exceeding max length", async () => {
    const res = await post(app(), "/register", { email: "a@b.com", password: "a".repeat(129) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string; reason: string } };
    expect(body.error.reason).toBe("password_too_long");
  });

  it("POST /login rejects invalid json", async () => {
    const a = app();
    const res = await a.request(
      "/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: TEST_ENV.ALLOWED_ORIGIN as string,
        },
        body: "not json",
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("POST /login rejects missing fields", async () => {
    const res = await post(app(), "/login", {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("email_must_be_string");
  });

  it("PATCH /name rejects empty name", async () => {
    const a = app();
    const guestRes = await post(a, "/guest");
    const cookie = extractSessionCookie(guestRes);
    const res = await patch(a, "/name", { displayName: "" }, { Cookie: `session=${cookie}` });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("name_empty");
  });

  it("PATCH /name rejects too-long name", async () => {
    const a = app();
    const guestRes = await post(a, "/guest");
    const cookie = extractSessionCookie(guestRes);
    const res = await patch(
      a,
      "/name",
      { displayName: "a".repeat(21) },
      { Cookie: `session=${cookie}` },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("name_too_long");
  });
});

describe("unauthenticated access", () => {
  it("GET /me without token returns 401 with UNAUTHORIZED type", async () => {
    const res = await get(app(), "/me");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { type: string } };
    expect(body.error.type).toBe("UNAUTHORIZED");
  });

  it("POST /logout without token returns 401 with UNAUTHORIZED type", async () => {
    const res = await post(app(), "/logout");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { type: string } };
    expect(body.error.type).toBe("UNAUTHORIZED");
  });
});

describe("error response structure", () => {
  it("400 includes error type and reason", async () => {
    const res = await post(app(), "/register", { email: "bad", password: "12345678" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { type: string; reason: string } };
    expect(body.error).toHaveProperty("type");
    expect(body.error).toHaveProperty("reason");
  });

  it("409 duplicate email includes AUTH_EMAIL_TAKEN type", async () => {
    const a = app();
    await post(a, "/register", { email: "dup@test.com", password: "password123" });
    const res = await post(a, "/register", { email: "dup@test.com", password: "password456" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { type: string } };
    expect(body.error.type).toBe("AUTH_EMAIL_TAKEN");
  });

  // D1 enforces FK constraints unconditionally (PRAGMA foreign_keys=OFF is no-op).
  // A "valid session + missing player" state cannot occur in production D1,
  // so this edge-case test is not applicable to the D1 runtime.
});
