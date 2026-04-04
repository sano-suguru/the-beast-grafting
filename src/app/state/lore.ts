import { signal } from "@preact/signals";
import type { LoreDb } from "../types";
import { fetchLore } from "../api/lore-client";
import { error as logError } from "../../shared/logger";

export const loreDb = signal<LoreDb>({});

let inflight: Promise<void> | null = null;
let lastLoadedAt = 0;
const STALE_MS = 30_000;

export function loadLore(): Promise<void> {
  if (inflight) return inflight;
  if (Date.now() - lastLoadedAt < STALE_MS) return Promise.resolve();
  inflight = doLoadLore().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doLoadLore(): Promise<void> {
  const result = await fetchLore();
  result.match(
    (data) => {
      loreDb.value = data;
      lastLoadedAt = Date.now();
    },
    (e) => {
      logError("[loadLore]", e);
    },
  );
}

export function _resetForTest(): void {
  loreDb.value = {};
  lastLoadedAt = 0;
  inflight = null;
}
