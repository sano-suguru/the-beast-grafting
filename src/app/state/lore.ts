import { signal, effect } from "@preact/signals";
import type { LoreDb, LoreEntry } from "../types";
import { fromThrowable } from "../../shared/errors";
import type { InfraError } from "../../shared/errors";
import { safeGetItem, safeSetItem } from "./storage";
import { invariant } from "../../shared/invariant";

const STORAGE_KEY = "beastGrafterLore";

const safeParseJson = fromThrowable(
  (json: string): unknown => JSON.parse(json),
  (e): InfraError => ({ type: "STORAGE_PARSE_FAILED", cause: e }),
);

function loadLoreFromStorage(): LoreDb {
  const saved = safeGetItem(STORAGE_KEY);
  if (!saved) return {};
  const parsed = safeParseJson(saved).unwrapOr(null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const result: LoreDb = {};
  for (const [key, value] of Object.entries(parsed)) {
    invariant(
      !!value &&
        typeof value === "object" &&
        typeof (value as Record<string, unknown>)["seen"] === "boolean" &&
        typeof (value as Record<string, unknown>)["mastered"] === "boolean",
      `Invalid lore entry for "${key}"`,
    );
    result[key] = value as LoreEntry;
  }
  return result;
}

export const loreDb = signal<LoreDb>(loadLoreFromStorage());

effect(() => {
  safeSetItem(STORAGE_KEY, JSON.stringify(loreDb.value));
});

export function markSeen(ids: string[]) {
  const prev = loreDb.value;
  const next = { ...prev };
  let changed = false;
  ids.forEach((id) => {
    if (id && !next[id]?.seen) {
      next[id] = { seen: true, mastered: next[id]?.mastered ?? false };
      changed = true;
    }
  });
  if (changed) loreDb.value = next;
}

export function markMastered(ids: string[]) {
  const prev = loreDb.value;
  const next = { ...prev };
  let changed = false;
  ids.forEach((id) => {
    if (id && !next[id]?.mastered) {
      next[id] = { seen: true, mastered: true };
      changed = true;
    }
  });
  if (changed) loreDb.value = next;
}
