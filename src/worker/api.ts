import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { error } from "../shared/logger";
import auth from "./auth/routes";
import lore from "./lore/routes";
import pvp from "./pvp/routes";
import run from "./run/routes";
import shop from "./shop/routes";
import type { AppEnv } from "./auth/types";

const api = new Hono<AppEnv>();

api.use("*", async (c, next) => {
  c.set("db", drizzle(c.env.DB));
  return cors({ origin: c.env.ALLOWED_ORIGIN, credentials: true })(c, next);
});

api.onError((err, c) => {
  error("[api]", err);
  return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
});

api.get("/health", (c) => {
  return c.json({ status: "alive", message: "工房は稼働中だ。" });
});

api.route("/auth", auth);
api.route("/lore", lore);
api.route("/pvp", pvp);
api.route("/run", run);
api.route("/shop", shop);

export default api;
