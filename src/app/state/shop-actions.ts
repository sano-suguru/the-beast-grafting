import { batch } from "@preact/signals";
import type { ShopStateResponse } from "../../shared/api-types";
import { boardUnitToUnitInstance } from "../../shared/board-unit";
import { fetchErr } from "../../shared/errors";
import { loadLore } from "./lore";
import type { Result, InfraError } from "../../shared/errors";
import type { SoundType, SoundResult } from "../types";
import { NO_SOUND, SE_ERROR } from "../sound-results";
import { error as logError } from "../../shared/logger";
import {
  blood,
  board,
  round,
  life,
  trophy,
  freeRoll,
  cultistUsed,
  selection,
  hoveredItem,
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
  onSuccess: (state: ShopStateResponse) => SoundType | null = () => null,
): SoundResult {
  shopLocked.value = true;
  shopActionError.value = null;
  return request
    .then(async (result): SoundResult => {
      if (phase.value !== "SHOP") {
        shopLocked.value = false;
        return null;
      }
      if (result.isErr() && isConflict(result.error)) {
        const synced = await resyncShopState();
        shopLocked.value = false;
        if (!synced) {
          selection.value = null;
          handleShopError(`${label}:resync`)(result.error);
          return "error";
        }
        return null;
      }
      let sound: SoundType | null = null;
      batch(() => {
        if (result.isOk()) {
          applyShopState(result.value);
          sound = onSuccess(result.value);
        } else {
          handleShopError(label)(result.error);
          sound = "error";
        }
        shopLocked.value = false;
      });
      return sound;
    })
    .catch((error: unknown): null => {
      batch(() => {
        shopLocked.value = false;
        shopActionError.value = fetchErr(error);
      });
      logError(`${label}:crash`, error);
      return null;
    });
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
    life.value = state.life;
    trophy.value = state.trophy;
    selection.value = null;
    hoveredItem.value = null;
    currentEnemyTeam.value = null;
  });
}

export function setupNight(runId: string, useTutorialShop = false): SoundResult {
  return runShopAction("[setupNight]", apiSetupShop(runId, useTutorialShop), () => {
    showHelpOverlay.value = false;
    void loadLore();
    return null;
  });
}

export function rollShop(): SoundResult {
  if (shopLocked.value) return NO_SOUND;
  if (activeEvent.value?.lockRoll) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;

  return runShopAction("[rollShop]", apiRollShop(runId), () => {
    if (onboardingStep.value === "roll") onboardingStep.value = "battle";
    return "select";
  });
}

export function handleFreezeClick(
  slotType: "unit" | "item" | "reward",
  index: number,
  frozen: boolean,
): SoundResult {
  if (shopLocked.value) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;

  return runShopAction("[freeze]", apiFreezeSlot(runId, slotType, index, frozen), () => "select");
}

export function executeSellUnit(): SoundResult {
  if (shopLocked.value) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;
  const sel = selection.value;
  if (!sel || sel.type !== "BOARD_UNIT") return SE_ERROR;

  return runShopAction("[sell]", apiSellUnit(runId, sel.index), () => "graft");
}

export function useCultistAbility(): SoundResult {
  if (shopLocked.value) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;

  return runShopAction("[cultist]", apiUseCultist(runId), () => "graft");
}
