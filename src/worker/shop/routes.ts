import { Hono } from "hono";
import { safeAsync, dbErr } from "../../shared/errors";
import { runs } from "../../db/schema";
import { requireAuth } from "../auth/middleware";
import type { AuthEnv } from "../auth/types";
import { jsonBody, getParsedBody, bodyField } from "../parse-json";
import { internalError } from "../error-response";
import { executeSetup } from "./shop-service";
import { executeRoll, executeBuy, executeBuyReward, executeSell } from "./shop-actions-trade";
import {
  executeEquip,
  executeFreeze,
  executeSwap,
  executeCultist,
  executeUndo,
  executeReady,
} from "./shop-actions";
import {
  toResponse,
  parseOriginId,
  activeRunFilter,
  ensureShopSeed,
  upsertShopState,
  normalizePrevBoard,
  loadShopState,
  loadPrevRoundShop,
} from "./shop-db";
import { extractLoreUnitIds } from "../lore/lore-helpers";
import { markSeenAsync } from "../lore/lore-service";
import {
  validateRunId,
  validateIndex,
  validateBoolean,
  preconditionFailed,
  shopAction,
  shopActionWithParsed,
} from "./shop-helpers";

const shopRoutes = new Hono<AuthEnv>();

shopRoutes.post("/setup", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const body = getParsedBody(c);
  const runId = validateRunId(body);
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);

  const runResult = await safeAsync(
    () => db.select().from(runs).where(activeRunFilter(runId, playerId)).limit(1),
    dbErr,
  );
  if (runResult.isErr()) return internalError(c, "[shop/setup:run]", runResult.error);
  const run = runResult.value[0];
  if (!run) return c.json({ error: { type: "NOT_FOUND", entity: "run" } }, 404);

  const seedResult = await ensureShopSeed(db, runId, run.shopSeed);
  if (seedResult.isErr()) return internalError(c, "[shop/setup:seed]", seedResult.error);
  const shopSeed = seedResult.value;

  const prevResult = await loadPrevRoundShop(db, runId, run.round);
  if (prevResult.isErr()) return internalError(c, "[shop/setup:prev]", prevResult.error);
  const prev = prevResult.value;
  const useTutorialShop = bodyField(body, "useTutorialShop") === true;
  const state = executeSetup(
    run.round,
    run.sanity,
    parseOriginId(run.originId),
    shopSeed,
    normalizePrevBoard(run.board),
    useTutorialShop,
    prev.shopUnits,
    prev.shopItems,
  );

  const insertResult = await upsertShopState(db, runId, state);
  if (insertResult.isErr()) return internalError(c, "[shop/setup:insert]", insertResult.error);

  const seenIds = extractLoreUnitIds(state.board, state.shopUnits, state.rewardSlots);
  markSeenAsync(db, playerId, seenIds, "[shop/setup:lore]");

  return c.json({ shop: toResponse(state, run.trophy) });
});

shopRoutes.post("/roll", requireAuth, jsonBody(), (c) =>
  shopAction(
    c,
    (state, run) => executeRoll(state, run.originId),
    (db, playerId, state) => {
      const ids = extractLoreUnitIds(state.board, state.shopUnits, state.rewardSlots);
      markSeenAsync(db, playerId, ids, "[shop/roll:lore]");
    },
  ),
);

shopRoutes.post("/buy", requireAuth, jsonBody(), (c) =>
  shopActionWithParsed(
    c,
    (body) => {
      const shopIndex = validateIndex(body, "shopIndex");
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return shopIndex !== null && boardIndex !== null ? { shopIndex, boardIndex } : null;
    },
    ({ state, extra: { shopIndex, boardIndex } }) => executeBuy(state, shopIndex, boardIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/buy-reward", requireAuth, jsonBody(), (c) =>
  shopActionWithParsed(
    c,
    (body) => {
      const rewardIndex = validateIndex(body, "rewardIndex");
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return rewardIndex !== null && boardIndex !== null ? { rewardIndex, boardIndex } : null;
    },
    ({ state, extra: { rewardIndex, boardIndex } }) =>
      executeBuyReward(state, rewardIndex, boardIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/sell", requireAuth, jsonBody(), (c) =>
  shopActionWithParsed(
    c,
    (body) => {
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return boardIndex !== null ? { boardIndex } : null;
    },
    ({ state, run, extra: { boardIndex } }) => executeSell(state, boardIndex, run.originId),
    "invalid_index",
  ),
);

shopRoutes.post("/equip", requireAuth, jsonBody(), (c) =>
  shopActionWithParsed(
    c,
    (body) => {
      const shopItemIndex = validateIndex(body, "shopItemIndex");
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return shopItemIndex !== null && boardIndex !== null ? { shopItemIndex, boardIndex } : null;
    },
    ({ state, extra: { shopItemIndex, boardIndex } }) =>
      executeEquip(state, shopItemIndex, boardIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/freeze", requireAuth, jsonBody(), (c) =>
  shopActionWithParsed(
    c,
    (body) => {
      const slotType = bodyField(body, "slotType");
      if (slotType !== "unit" && slotType !== "item" && slotType !== "reward") return null;
      const index = validateIndex(body, "index");
      const frozen = validateBoolean(body, "frozen");
      return index !== null && frozen !== null
        ? { slotType: slotType as "unit" | "item" | "reward", index, frozen }
        : null;
    },
    ({ state, extra: { slotType, index, frozen } }) =>
      executeFreeze(state, slotType, index, frozen),
  ),
);

shopRoutes.post("/swap", requireAuth, jsonBody(), (c) =>
  shopActionWithParsed(
    c,
    (body) => {
      const fromIndex = validateIndex(body, "fromIndex", 4);
      const toIndex = validateIndex(body, "toIndex", 4);
      return fromIndex !== null && toIndex !== null ? { fromIndex, toIndex } : null;
    },
    ({ state, extra: { fromIndex, toIndex } }) => executeSwap(state, fromIndex, toIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/cultist", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state, run) => executeCultist(state, run.originId)),
);

shopRoutes.post("/undo", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state) => executeUndo(state)),
);

shopRoutes.post("/ready", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state) => executeReady(state)),
);

shopRoutes.get("/state", requireAuth, async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId") as string;
  const runId = c.req.query("runId");
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);

  const loaded = await loadShopState(db, playerId, runId);
  if (loaded.type === "error") return internalError(c, "[shop:state]", loaded.error);
  if (loaded.type === "not_found")
    return c.json({ error: { type: "NOT_FOUND", entity: loaded.entity } }, 404);
  return c.json({ shop: toResponse(loaded.state, loaded.run.trophy) });
});

export default shopRoutes;
