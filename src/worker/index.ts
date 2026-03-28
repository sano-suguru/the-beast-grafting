import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import api from "./api";
import { cleanExpiredSessions } from "./auth/session";
import { error as logError } from "../shared/logger";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", api);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const db = drizzle(env.DB);
    const result = await cleanExpiredSessions(db);
    if (result.isErr()) logError("[scheduled] session cleanup failed", result.error);
  },
};
