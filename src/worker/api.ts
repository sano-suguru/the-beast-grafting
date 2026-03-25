import { Hono } from "hono";
import { cors } from "hono/cors";
import { error, warn } from "../shared/logger";

const api = new Hono<{ Bindings: Env }>();

api.use("*", async (c, next) => {
  const origin = c.env?.ALLOWED_ORIGIN;
  if (!origin) {
    warn("[api] ALLOWED_ORIGIN is not set — all cross-origin requests will be rejected");
  }
  return cors({ origin: origin ?? "https://not-configured.invalid" })(c, next);
});

api.onError((err, c) => {
  error("[api]", err);
  return c.json({ status: "error", message: "内部エラー" }, 500);
});

api.get("/health", (c) => {
  return c.json({ status: "alive", message: "工房は稼働中だ。" });
});

export default api;
