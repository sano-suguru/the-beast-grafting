import { Hono } from "hono";
import { requireAuth } from "../auth/middleware";
import type { AuthEnv } from "../auth/types";
import { internalError } from "../error-response";
import { getLore } from "./lore-service";

const lore = new Hono<AuthEnv>();

lore.get("/", requireAuth, async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");

  const result = await getLore(db, playerId);
  if (result.isErr()) return internalError(c, "[lore]", result.error);

  return c.json({ lore: result.value });
});

export default lore;
