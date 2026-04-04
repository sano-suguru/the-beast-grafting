import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Context } from "hono";
import { getCookie, deleteCookie } from "hono/cookie";
import { safeAsync, dbErr, err, ok } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { error as logError, warn as logWarn } from "../../shared/logger";
import { players, authProviders } from "../../db/schema";
import { generateId, verifyState } from "./crypto";
import { GUEST_NAME_PREFIX, sanitizeDisplayName } from "./names";
import { createSession, setSessionCookie } from "./session";
import type { OptionalAuthEnv } from "./types";

export type OAuthProvider = "discord" | "google";

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

const PROVIDER_CONFIGS: Record<OAuthProvider, ProviderConfig> = {
  discord: {
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me",
    scopes: ["identify", "email"],
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
};

interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  creds: OAuthCredentials,
  redirectUri: string,
  state: string,
): string {
  const config = PROVIDER_CONFIGS[provider];
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

const oauthErr = (e: unknown): InfraError => ({ type: "AUTH_OAUTH_FAILED", cause: e });

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Result<Record<string, unknown>, InfraError>> {
  const res = await safeAsync(() => fetch(url, init), oauthErr);
  if (res.isErr()) return err(res.error);
  if (!res.value.ok) {
    const body = await res.value.text().catch((error: unknown) => {
      logWarn("[oauth] failed to read error response body", error);
      return "";
    });
    return err(oauthErr(`${res.value.status} ${body.slice(0, 200)}`));
  }
  return safeAsync(() => res.value.json() as Promise<Record<string, unknown>>, oauthErr);
}

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  creds: OAuthCredentials,
  redirectUri: string,
): Promise<Result<string, InfraError>> {
  const config = PROVIDER_CONFIGS[provider];
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const data = await fetchJson(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (data.isErr()) return err(data.error);
  return requireStr(data.value, "access_token");
}

interface OAuthUserInfo {
  providerId: string;
  displayName: string;
}

function requireStr(data: Record<string, unknown>, ...keys: string[]): Result<string, InfraError> {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v) return ok(v);
  }
  return err(oauthErr(`required field missing: ${keys.join(" | ")}`));
}

function optionalStr(data: Record<string, unknown>, key: string, fallback: string): string {
  const v = data[key];
  return typeof v === "string" ? v : fallback;
}

export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string,
): Promise<Result<OAuthUserInfo, InfraError>> {
  const config = PROVIDER_CONFIGS[provider];
  const data = await fetchJson(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (data.isErr()) return err(data.error);

  const providerId =
    provider === "discord" ? requireStr(data.value, "id") : requireStr(data.value, "sub");
  if (providerId.isErr()) return err(providerId.error);

  if (provider === "discord") {
    return ok({
      providerId: providerId.value,
      displayName: sanitizeDisplayName(
        optionalStr(data.value, "global_name", optionalStr(data.value, "username", "Unknown")),
      ),
    });
  }
  return ok({
    providerId: providerId.value,
    displayName: sanitizeDisplayName(optionalStr(data.value, "name", "Unknown")),
  });
}

function makeProviderValues(
  playerId: string,
  provider: OAuthProvider,
  providerId: string,
  now: Date,
) {
  return { id: generateId(), playerId, provider, providerId, createdAt: now };
}

async function linkToExistingPlayer(
  db: DrizzleD1Database,
  existingPlayerId: string,
  provider: OAuthProvider,
  userInfo: OAuthUserInfo,
): Promise<{ playerId: string; isNew: boolean } | null> {
  const now = new Date();
  const current = await db
    .select({ displayName: players.displayName })
    .from(players)
    .where(eq(players.id, existingPlayerId))
    .limit(1);

  if (!current[0]) return null;

  const shouldUpdateName = current[0].displayName.startsWith(GUEST_NAME_PREFIX);
  await db.batch([
    db
      .insert(authProviders)
      .values(makeProviderValues(existingPlayerId, provider, userInfo.providerId, now)),
    db
      .update(players)
      .set({ ...(shouldUpdateName ? { displayName: userInfo.displayName } : {}), updatedAt: now })
      .where(eq(players.id, existingPlayerId)),
  ]);
  return { playerId: existingPlayerId, isNew: false };
}

export function findOrCreateByProvider(
  db: DrizzleD1Database,
  provider: OAuthProvider,
  userInfo: OAuthUserInfo,
  existingPlayerId: string | null,
): Promise<Result<{ playerId: string; isNew: boolean }, InfraError>> {
  return safeAsync(async () => {
    const existing = await db
      .select()
      .from(authProviders)
      .where(
        and(
          eq(authProviders.provider, provider),
          eq(authProviders.providerId, userInfo.providerId),
        ),
      )
      .limit(1);

    if (existing[0]) return { playerId: existing[0].playerId, isNew: false };

    if (existingPlayerId) {
      const linked = await linkToExistingPlayer(db, existingPlayerId, provider, userInfo);
      if (linked) return linked;
    }

    const now = new Date();
    const playerId = generateId();
    await db.batch([
      db.insert(players).values({
        id: playerId,
        displayName: userInfo.displayName,
        createdAt: now,
        updatedAt: now,
      }),
      db
        .insert(authProviders)
        .values(makeProviderValues(playerId, provider, userInfo.providerId, now)),
    ]);
    return { playerId, isNew: true };
  }, dbErr);
}

export function getOAuthCredentials(env: Env, provider: OAuthProvider) {
  if (provider === "discord") {
    return { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET };
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

export function getRedirectUri(env: Env, provider: OAuthProvider): string {
  return `${env.ALLOWED_ORIGIN}/api/auth/${provider}/callback`;
}

export async function handleOAuthCallback(
  c: Context<OptionalAuthEnv>,
  provider: OAuthProvider,
): Promise<Response> {
  const errorRedirect = (code: string) =>
    c.redirect(`${c.env.ALLOWED_ORIGIN}/?auth_error=${encodeURIComponent(code)}`);

  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedSigned = getCookie(c, `oauth_state_${provider}`);
  deleteCookie(c, `oauth_state_${provider}`, { path: "/api" });

  if (!code || !state || !storedSigned) return errorRedirect("invalid_state");

  const verifiedState = await verifyState(storedSigned, c.env.OAUTH_STATE_SECRET);
  if (!verifiedState || verifiedState !== state) return errorRedirect("invalid_state");

  const tokenResult = await exchangeCode(
    provider,
    code,
    getOAuthCredentials(c.env, provider),
    getRedirectUri(c.env, provider),
  );
  if (tokenResult.isErr()) {
    logError(`[oauth/${provider}] token exchange failed`, tokenResult.error);
    return errorRedirect("oauth_failed");
  }

  const userResult = await fetchUserInfo(provider, tokenResult.value);
  if (userResult.isErr()) {
    logError(`[oauth/${provider}] user info fetch failed`, userResult.error);
    return errorRedirect("oauth_failed");
  }

  return finalizeOAuthLogin(c, provider, userResult.value, errorRedirect);
}

async function finalizeOAuthLogin(
  c: Context<OptionalAuthEnv>,
  provider: OAuthProvider,
  userInfo: OAuthUserInfo,
  errorRedirect: (code: string) => Response,
): Promise<Response> {
  const db = c.get("db");
  const existingPlayerId = (c.get("playerId") as string | undefined) ?? null;

  const linkResult = await findOrCreateByProvider(db, provider, userInfo, existingPlayerId);
  if (linkResult.isErr()) {
    logError(`[oauth/${provider}] find/create provider failed`, linkResult.error);
    return errorRedirect("internal_error");
  }

  const sessionResult = await createSession(db, linkResult.value.playerId);
  if (sessionResult.isErr()) {
    logError(`[oauth/${provider}] session creation failed`, sessionResult.error);
    return errorRedirect("internal_error");
  }

  setSessionCookie(c, sessionResult.value.token, sessionResult.value.expiresAt, c.env);
  return c.redirect(c.env.ALLOWED_ORIGIN);
}
