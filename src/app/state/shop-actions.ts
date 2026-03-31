import { batch } from "@preact/signals";
import type { ShopStateResponse } from "../../shared/api-types";
import { boardUnitToUnitInstance } from "../../shared/board-unit";
import { fetchErr } from "../../shared/errors";
import type { InfraError } from "../../shared/errors";
import { error as logError } from "../../shared/logger";
import { initAudio, playSE } from "../engine/audio";
import {
  blood,
  board,
  round,
  sanity,
  trophy,
  freeRoll,
  cultistUsed,
  selection,
  shopUnits,
  shopItems,
  currentEnemyTeam,
  rotRingUses,
  activeEvent,
  canUndo,
  shopLocked,
  shopActionError,
  currentRunId,
  onboardingStep,
  showHelpOverlay,
  phase,
} from "./game-store";
import { markSeen } from "./lore";
import {
  setupShop as apiSetupShop,
  rollShop as apiRollShop,
  freezeSlot as apiFreezeSlot,
  sellUnit as apiSellUnit,
  useCultist as apiUseCultist,
  getShopState as apiGetShopState,
} from "../api/shop-client";

function handleShopError(label: string) {
  return (e: InfraError) => {
    logError(label, e);
    playSE("error");
    shopActionError.value = e;
  };
}

function isConflict(e: InfraError): boolean {
  return e.type === "API_FETCH_FAILED" && e.status === 409;
}

async function resyncShopState(): Promise<boolean> {
  const runId = currentRunId.value;
  if (!runId) return false;
  const fresh = await apiGetShopState(runId);
  if (fresh.isErr()) return false;
  batch(() => applyShopState(fresh.value));
  return true;
}

export function runShopAction(
  label: string,
  request: Promise<import("neverthrow").Result<ShopStateResponse, InfraError>>,
  onSuccess: (state: ShopStateResponse) => void = () => {},
) {
  shopLocked.value = true;
  shopActionError.value = null;
  void request
    .then(async (result) => {
      if (phase.value !== "SHOP") {
        shopLocked.value = false;
        return;
      }
      if (result.isErr() && isConflict(result.error)) {
        const synced = await resyncShopState();
        shopLocked.value = false;
        if (!synced) handleShopError(`${label}:resync`)(result.error);
        return;
      }
      batch(() => {
        result.match((state) => {
          applyShopState(state);
          onSuccess(state);
        }, handleShopError(label));
        shopLocked.value = false;
      });
    })
    .catch((e: unknown) => {
      batch(() => {
        shopLocked.value = false;
        shopActionError.value = fetchErr(e);
      });
      logError(`${label}:crash`, e);
    });
}

function markShopUnitsSeen(slots: (NonNullable<(typeof shopUnits.value)[number]> | null)[]): void {
  markSeen(slots.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.unit.id));
}

export function applyShopState(state: ShopStateResponse) {
  batch(() => {
    blood.value = state.blood;
    board.value = state.board.map((bu) => (bu ? boardUnitToUnitInstance(bu) : null));
    shopUnits.value = state.shopUnits.map((s) =>
      s
        ? {
            unit: boardUnitToUnitInstance(s.unit),
            frozen: s.frozen,
            ...(s.costOverride !== undefined ? { costOverride: s.costOverride } : {}),
          }
        : null,
    );
    shopItems.value = state.shopItems.map((s) => (s ? { item: s.item, frozen: s.frozen } : null));
    freeRoll.value = state.freeRoll;
    cultistUsed.value = state.cultistUsed;
    rotRingUses.value = state.rotRingUses;
    activeEvent.value = state.activeEvent;
    canUndo.value = state.canUndo;
    round.value = state.round;
    sanity.value = state.sanity;
    trophy.value = state.trophy;
    selection.value = null;
    currentEnemyTeam.value = null;
  });
}

export async function setupNight(runId: string, useTutorialShop = false) {
  shopLocked.value = true;
  shopActionError.value = null;
  try {
    const result = await apiSetupShop(runId, useTutorialShop);
    if (phase.value !== "SHOP") {
      shopLocked.value = false;
      return;
    }
    batch(() => {
      result.match((state) => {
        applyShopState(state);
        showHelpOverlay.value = false;
        markShopUnitsSeen(shopUnits.value);
      }, handleShopError("[setupNight]"));
      shopLocked.value = false;
    });
  } catch (e: unknown) {
    batch(() => {
      shopLocked.value = false;
      shopActionError.value = fetchErr(e);
    });
    logError("[setupNight:crash]", e);
  }
}

export function rollShop() {
  if (shopLocked.value) return;
  if (activeEvent.value?.lockRoll) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  runShopAction("[rollShop]", apiRollShop(runId), () => {
    playSE("select");
    if (onboardingStep.value === "roll") onboardingStep.value = "battle";
    markShopUnitsSeen(shopUnits.value);
  });
}

export function handleFreezeClick(isUnit: boolean, index: number, frozen: boolean) {
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  runShopAction("[freeze]", apiFreezeSlot(runId, isUnit, index, frozen), () => {
    playSE("select");
  });
}

export function executeSellUnit() {
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;
  const sel = selection.value;
  if (!sel || sel.type !== "BOARD_UNIT") {
    playSE("error");
    return;
  }

  runShopAction("[sell]", apiSellUnit(runId, sel.index), () => {
    playSE("graft");
  });
}

export function useCultistAbility() {
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  runShopAction("[cultist]", apiUseCultist(runId), () => {
    playSE("graft");
  });
}
