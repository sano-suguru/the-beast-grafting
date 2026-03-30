import type { DrizzleD1Database } from "drizzle-orm/d1";

type DbVariables = { db: DrizzleD1Database };
type MiddlewareVariables = { parsedBody?: unknown };

export type AppEnv = {
  Bindings: Env;
  Variables: DbVariables & MiddlewareVariables;
};

export type AuthEnv = {
  Bindings: Env;
  Variables: DbVariables & MiddlewareVariables & { playerId: string; sessionToken: string };
};

export type OptionalAuthEnv = {
  Bindings: Env;
  Variables: DbVariables & MiddlewareVariables & { playerId?: string; sessionToken?: string };
};
