import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { eq, and } from "drizzle-orm";
import type { Context } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { ok, err, safeAsync, dbErr } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
import { players, authProviders } from "../../db/schema";
import { generateId, hashPassword, verifyPassword, signState } from "./crypto";
import { createSession, revokeSession, setSessionCookie } from "./session";
import { generateGuestName, emailLocalToDisplayName } from "./names";
import { requireAuth, optionalAuth } from "./middleware";
import { validateEmail, validatePassword } from "./validation";
import {
  buildAuthorizeUrl,
  handleOAuthCallback,
  getOAuthCredentials,
  getRedirectUri,
} from "./oauth";
import type { OAuthProvider } from "./oauth";
import type { AppEnv } from "./types";

const auth = new Hono<AppEnv>();

function fetchPlayer(db: DrizzleD1Database, playerId: string) {
  return safeAsync(() => db.select().from(players).where(eq(players.id, playerId)).limit(1), dbErr);
}

function parseEmailPassword(body: {
  email?: unknown;
  password?: unknown;
}): Result<{ email: string; password: string }, GameError> {
  const emailResult = validateEmail(body.email);
  if (emailResult.isErr()) return err(emailResult.error);
  const passwordResult = validatePassword(body.password);
  if (passwordResult.isErr()) return err(passwordResult.error);
  return ok({ email: emailResult.value, password: passwordResult.value });
}

async function parseCredentials(c: {
  req: { json: <T>() => Promise<T> };
}): Promise<Result<{ email: string; password: string }, GameError>> {
  const bodyResult = await safeAsync(
    () => c.req.json<{ email?: unknown; password?: unknown }>(),
    (): GameError => ({ type: "PRECONDITION_FAILED", reason: "invalid_json" }),
  );
  if (bodyResult.isErr()) return err(bodyResult.error);
  return parseEmailPassword(bodyResult.value);
}

async function issueSessionAndRespond<E extends { Bindings: Env }>(
  c: Context<E>,
  db: DrizzleD1Database,
  playerId: string,
): Promise<Response> {
  const sessionResult = await createSession(db, playerId);
  if (sessionResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);

  setSessionCookie(c, sessionResult.value.token, sessionResult.value.expiresAt, c.env);

  const playerResult = await fetchPlayer(db, playerId);
  if (playerResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
  invariant(playerResult.value[0], "player must exist after insert");
  return c.json({ playerId, displayName: playerResult.value[0].displayName });
}

auth.post("/guest", async (c) => {
  const db = c.get("db");
  const playerId = generateId();
  const now = new Date();

  const insertResult = await safeAsync(
    () =>
      db.insert(players).values({
        id: playerId,
        displayName: generateGuestName(),
        createdAt: now,
        updatedAt: now,
      }),
    dbErr,
  );
  if (insertResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);

  return issueSessionAndRespond(c, db, playerId);
});

async function insertEmailProvider(
  db: DrizzleD1Database,
  playerId: string,
  existingPlayerId: string | undefined,
  email: string,
  hash: { hash: string; salt: string },
) {
  const now = new Date();
  const authProviderValues = {
    id: generateId(),
    playerId,
    provider: "email" as const,
    providerId: email,
    credential: hash.hash,
    credentialSalt: hash.salt,
    createdAt: now,
  };

  if (existingPlayerId) {
    return safeAsync(() => db.insert(authProviders).values(authProviderValues), dbErr);
  }
  return safeAsync(
    () =>
      db.batch([
        db.insert(players).values({
          id: playerId,
          displayName: emailLocalToDisplayName(email),
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(authProviders).values(authProviderValues),
      ]),
    dbErr,
  );
}

auth.post("/register", optionalAuth, async (c) => {
  const credentialsResult = await parseCredentials(c);
  if (credentialsResult.isErr()) return c.json({ error: credentialsResult.error }, 400);

  const { email, password } = credentialsResult.value;

  const hashResult = await hashPassword(password);
  if (hashResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);

  const db = c.get("db");
  const existingPlayerId = c.get("playerId");

  const existingResult = await safeAsync(
    () =>
      db
        .select()
        .from(authProviders)
        .where(and(eq(authProviders.provider, "email"), eq(authProviders.providerId, email)))
        .limit(1),
    dbErr,
  );
  if (existingResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
  if (existingResult.value[0]) return c.json({ error: { type: "AUTH_EMAIL_TAKEN" } }, 409);

  const playerId = existingPlayerId ?? generateId();
  const insertResult = await insertEmailProvider(
    db,
    playerId,
    existingPlayerId,
    email,
    hashResult.value,
  );
  if (insertResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);

  return issueSessionAndRespond(c, db, playerId);
});

auth.post("/login", async (c) => {
  const credentialsResult = await parseCredentials(c);
  if (credentialsResult.isErr()) return c.json({ error: credentialsResult.error }, 400);

  const db = c.get("db");
  const providerResult = await safeAsync(
    () =>
      db
        .select()
        .from(authProviders)
        .where(
          and(
            eq(authProviders.provider, "email"),
            eq(authProviders.providerId, credentialsResult.value.email),
          ),
        )
        .limit(1),
    dbErr,
  );
  if (providerResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);

  const provider = providerResult.value[0];
  if (!provider?.credential || !provider.credentialSalt) {
    return c.json({ error: { type: "AUTH_INVALID_CREDENTIALS" } }, 401);
  }

  const verifyResult = await verifyPassword(
    credentialsResult.value.password,
    provider.credential,
    provider.credentialSalt,
  );
  if (verifyResult.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
  if (!verifyResult.value) return c.json({ error: { type: "AUTH_INVALID_CREDENTIALS" } }, 401);

  return issueSessionAndRespond(c, db, provider.playerId);
});

function oauthRoutes(provider: OAuthProvider) {
  auth.get(`/${provider}`, async (c) => {
    const creds = getOAuthCredentials(c.env, provider);
    const redirectUri = getRedirectUri(c.env, provider);
    const state = generateId();
    const signed = await signState(state, c.env.OAUTH_STATE_SECRET);

    setCookie(c, `oauth_state_${provider}`, signed, {
      httpOnly: true,
      secure: c.env.ALLOWED_ORIGIN.startsWith("https://"),
      sameSite: "Lax",
      path: "/api",
      maxAge: 600,
    });

    return c.redirect(buildAuthorizeUrl(provider, creds, redirectUri, state));
  });

  auth.get(`/${provider}/callback`, optionalAuth, (c) => handleOAuthCallback(c, provider));
}

oauthRoutes("discord");
oauthRoutes("google");

auth.post("/logout", requireAuth, async (c) => {
  const db = c.get("db");
  const result = await revokeSession(db, c.get("sessionToken"));
  if (result.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
  deleteCookie(c, "session", { path: "/api" });
  return c.json({ ok: true });
});

auth.get("/me", requireAuth, async (c) => {
  const playerId = c.get("playerId");
  const db = c.get("db");

  const [playerResult, providersResult] = await Promise.all([
    fetchPlayer(db, playerId),
    safeAsync(
      () =>
        db
          .select({ provider: authProviders.provider })
          .from(authProviders)
          .where(eq(authProviders.playerId, playerId)),
      dbErr,
    ),
  ]);
  if (playerResult.isErr() || providersResult.isErr())
    return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
  if (!playerResult.value[0])
    return c.json({ error: { type: "NOT_FOUND", entity: "player" } }, 404);

  return c.json({
    playerId: playerResult.value[0].id,
    displayName: playerResult.value[0].displayName,
    providers: providersResult.value.map((p) => p.provider),
  });
});

export default auth;
