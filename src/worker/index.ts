import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import api from "./api";
import { cleanExpiredSessions } from "./auth/session";
import { cleanExpiredRateLimits } from "./auth/rate-limit";
import { cleanOldSnapshots } from "./pvp/cleanup";
import { error as logError } from "../shared/logger";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", api);

export default {
  fetch: app.fetch,
  // eslint-disable-next-line no-unused-vars -- positional params required by CF Workers scheduled handler
  async scheduled(_event: ScheduledEvent, env: Env, _executionCtx: ExecutionContext) {
    const db = drizzle(env.DB);
    const [sessionResult, snapshotResult, rateLimitResult] = await Promise.all([
      cleanExpiredSessions(db),
      cleanOldSnapshots(db),
      cleanExpiredRateLimits(db),
    ]);
    if (sessionResult.isErr()) logError("[scheduled] session cleanup failed", sessionResult.error);
    if (snapshotResult.isErr())
      logError("[scheduled] snapshot cleanup failed", snapshotResult.error);
    if (rateLimitResult.isErr())
      logError("[scheduled] rate limit cleanup failed", rateLimitResult.error);
  },
};
