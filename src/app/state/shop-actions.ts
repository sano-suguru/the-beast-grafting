import { batch } from "@preact/signals";
import type { ShopStateResponse } from "../../shared/api-types";
import { boardUnitToUnitInstance } from "../../shared/board-unit";
import { fetchErr } from "../../shared/errors";
import { loadLore } from "./lore";
import type { Result, InfraError } from "../../shared/errors";
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
  shopRewards,
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
  request: Promise<Result<ShopStateResponse, InfraError>>,
  onSuccess: (state: ShopStateResponse) => void = () => {},
): Promise<void> {
  shopLocked.value = true;
  shopActionError.value = null;
  const promise = request
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
    .catch((error: unknown) => {
      batch(() => {
        shopLocked.value = false;
        shopActionError.value = fetchErr(error);
      });
      logError(`${label}:crash`, error);
    });
  return promise;
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
            eventSourced: s.eventSourced,
          }
        : null,
    );
    shopItems.value = state.shopItems.map((s) => (s ? { item: s.item, frozen: s.frozen } : null));
    shopRewards.value = state.rewardSlots.map((s) =>
      s
        ? { unit: boardUnitToUnitInstance(s.unit), frozen: s.frozen, eventSourced: s.eventSourced }
        : null,
    );
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

export function setupNight(runId: string, useTutorialShop = false): Promise<void> {
  return runShopAction("[setupNight]", apiSetupShop(runId, useTutorialShop), () => {
    showHelpOverlay.value = false;
    void loadLore();
  });
}

export function rollShop() {
  if (shopLocked.value) return;
  if (activeEvent.value?.lockRoll) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  void runShopAction("[rollShop]", apiRollShop(runId), () => {
    playSE("select");
    if (onboardingStep.value === "roll") onboardingStep.value = "battle";
  });
}

export function handleFreezeClick(
  slotType: "unit" | "item" | "reward",
  index: number,
  frozen: boolean,
) {
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  void runShopAction("[freeze]", apiFreezeSlot(runId, slotType, index, frozen), () => {
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

  void runShopAction("[sell]", apiSellUnit(runId, sel.index), () => {
    playSE("graft");
  });
}

export function useCultistAbility() {
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  void runShopAction("[cultist]", apiUseCultist(runId), () => {
    playSE("graft");
  });
}
