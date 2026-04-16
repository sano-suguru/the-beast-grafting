import type { DrizzleD1Database } from "drizzle-orm/d1";

type DbVariables = { db: DrizzleD1Database };
type MiddlewareVariables = { parsedBody?: unknown };

type BaseVariables = DbVariables & MiddlewareVariables;
type AuthFields = { playerId: string; sessionToken: string };

export type AppEnv = {
  Bindings: Env;
  Variables: BaseVariables;
};

export type AuthEnv = {
  Bindings: Env;
  Variables: BaseVariables & AuthFields;
};

export type OptionalAuthEnv = {
  Bindings: Env;
  Variables: BaseVariables & Partial<AuthFields>;
};
