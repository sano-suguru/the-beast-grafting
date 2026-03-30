import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import api from "./api";
import { cleanExpiredSessions } from "./auth/session";
import { cleanOldSnapshots } from "./pvp/cleanup";
import { error as logError } from "../shared/logger";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", api);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const db = drizzle(env.DB);
    const [sessionResult, snapshotResult] = await Promise.all([
      cleanExpiredSessions(db),
      cleanOldSnapshots(db),
    ]);
    if (sessionResult.isErr()) logError("[scheduled] session cleanup failed", sessionResult.error);
    if (snapshotResult.isErr())
      logError("[scheduled] snapshot cleanup failed", snapshotResult.error);
  },
};
