import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { players, authProviders } from "../../db/schema";
import { generateId } from "./crypto";
import { GUEST_NAME_PREFIX, sanitizeDisplayName } from "./names";

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

export function exchangeCode(
  provider: OAuthProvider,
  code: string,
  creds: OAuthCredentials,
  redirectUri: string,
): Promise<Result<string, InfraError>> {
  const config = PROVIDER_CONFIGS[provider];
  return safeAsync(async () => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`token exchange failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return requireStr(data, "access_token");
  }, oauthErr);
}

interface OAuthUserInfo {
  providerId: string;
  displayName: string;
}

function requireStr(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v) return v;
  }
  throw new Error(`required field missing: ${keys.join(" | ")}`);
}

function optionalStr(data: Record<string, unknown>, key: string, fallback: string): string {
  const v = data[key];
  return typeof v === "string" ? v : fallback;
}

export function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string,
): Promise<Result<OAuthUserInfo, InfraError>> {
  const config = PROVIDER_CONFIGS[provider];
  return safeAsync(async () => {
    const res = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`user info failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as Record<string, unknown>;

    const providerId = provider === "discord" ? requireStr(data, "id") : requireStr(data, "sub");

    if (provider === "discord") {
      return {
        providerId,
        displayName: sanitizeDisplayName(
          optionalStr(data, "global_name", optionalStr(data, "username", "Unknown")),
        ),
      };
    }
    return {
      providerId,
      displayName: sanitizeDisplayName(optionalStr(data, "name", "Unknown")),
    };
  }, oauthErr);
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

    if (existing[0]) {
      return { playerId: existing[0].playerId, isNew: false };
    }

    const now = new Date();

    if (existingPlayerId) {
      const current = await db
        .select({ displayName: players.displayName })
        .from(players)
        .where(eq(players.id, existingPlayerId))
        .limit(1);

      if (current[0]) {
        const shouldUpdateName = current[0].displayName.startsWith(GUEST_NAME_PREFIX);
        await db.batch([
          db.insert(authProviders).values({
            id: generateId(),
            playerId: existingPlayerId,
            provider,
            providerId: userInfo.providerId,
            createdAt: now,
          }),
          db
            .update(players)
            .set({
              ...(shouldUpdateName ? { displayName: userInfo.displayName } : {}),
              updatedAt: now,
            })
            .where(eq(players.id, existingPlayerId)),
        ]);
        return { playerId: existingPlayerId, isNew: false };
      }
    }

    const playerId = generateId();
    await db.batch([
      db.insert(players).values({
        id: playerId,
        displayName: userInfo.displayName,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(authProviders).values({
        id: generateId(),
        playerId,
        provider,
        providerId: userInfo.providerId,
        createdAt: now,
      }),
    ]);
    return { playerId, isNew: true };
  }, dbErr);
}
