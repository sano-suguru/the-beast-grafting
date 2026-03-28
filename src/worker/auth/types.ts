import type { DrizzleD1Database } from "drizzle-orm/d1";

type DbVariables = { db: DrizzleD1Database };

export type AppEnv = {
  Bindings: Env;
  Variables: DbVariables;
};

export type AuthEnv = {
  Bindings: Env;
  Variables: DbVariables & { playerId: string; sessionToken: string };
};

export type OptionalAuthEnv = {
  Bindings: Env;
  Variables: DbVariables & { playerId?: string; sessionToken?: string };
};
