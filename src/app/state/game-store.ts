import { signal, computed, batch, type Signal } from "@preact/signals";
import type { UnlockableTier } from "../../shared/data/tiers";
import type {
  GamePhase,
  OriginId,
  UnitInstance,
  ShopSlot,
  ShopItemSlot,
  Selection,
  OnboardingStep,
  EnemyTeam,
  EnemyFaction,
  BattleFrame,
  BattleResult,
  EventData,
} from "../types";
import type { InfraError } from "../../shared/errors";

const registry: Array<{ reset(): void }> = [];

function resettableSignal<T>(factory: () => T): Signal<T> {
  const sig = signal(factory());
  registry.push({
    reset() {
      sig.value = factory();
    },
  });
  return sig;
}

export const phase = resettableSignal<GamePhase>(() => "TITLE");
export const origin = resettableSignal<OriginId | null>(() => null);
export const round = resettableSignal(() => 1);
export const blood = resettableSignal(() => 10);
export const life = resettableSignal(() => 5);
export const trophy = resettableSignal(() => 0);

export const board = resettableSignal<(UnitInstance | null)[]>(() => [
  null,
  null,
  null,
  null,
  null,
]);
export const shopUnits = resettableSignal<(ShopSlot | null)[]>(() => []);
export const shopItems = resettableSignal<(ShopItemSlot | null)[]>(() => []);
export const shopRewards = resettableSignal<(ShopSlot | null)[]>(() => []);
export const selection = resettableSignal<Selection | null>(() => null);
export const hoveredItem = resettableSignal<Selection | null>(() => null);
export const freeRoll = resettableSignal(() => false);
export const cultistUsed = resettableSignal(() => false);
export const onboardingStep = resettableSignal<OnboardingStep>(() => null);
export const rotRingUses = resettableSignal(() => 0);

export const currentEnemyTeam = resettableSignal<EnemyTeam | null>(() => null);
export const battleFrames = resettableSignal<BattleFrame[]>(() => []);
export const currentFrameIdx = resettableSignal(() => 0);
export const battleResult = resettableSignal<BattleResult>(() => null);
export const fastForward = resettableSignal(() => false);
export const lastBattleResult = resettableSignal<BattleResult>(() => null);
export const lastEnemyTeamType = resettableSignal<EnemyFaction | null>(() => null);

export const battleConcludeData = resettableSignal<{
  lifeDelta: number;
  trophyDelta: number;
  gameEnded: boolean;
  unlockedTier: UnlockableTier | null;
} | null>(() => null);

export const currentRunId = resettableSignal<string | null>(() => null);
export const lastBattleId = resettableSignal<string | null>(() => null);
export const battleError = resettableSignal<InfraError | null>(() => null);

export const battleBusy = resettableSignal(() => false);
export const battleLoading = resettableSignal(() => false);
export const battleLoadError = resettableSignal<InfraError | null>(() => null);

export const gameLoading = resettableSignal(() => false);

export const canUndo = resettableSignal(() => false);
export const shopLocked = resettableSignal(() => false);
export const shopActionError = resettableSignal<InfraError | null>(() => null);
export const startGameError = resettableSignal<InfraError | null>(() => null);
export const activeEvent = resettableSignal<EventData | null>(() => null);
export const showHelpOverlay = resettableSignal(() => false);
export const showRetireConfirm = resettableSignal(() => false);
export const recoveryWarning = resettableSignal<string | null>(() => null);
export const retiring = resettableSignal(() => false);
export const resourceError = resettableSignal<"blood" | "life" | null>(() => null);

const EMPTY_SET: ReadonlySet<string> = new Set();

function collectBoardIds(): Set<string> {
  const ids = new Set<string>();
  for (const u of board.value) {
    if (u && u.level < 3) ids.add(u.id);
  }
  return ids;
}

function collectMatchingShopIds(boardIds: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const slot of shopUnits.value) {
    if (slot && boardIds.has(slot.unit.id)) result.add(slot.unit.id);
  }
  for (const slot of shopRewards.value) {
    if (slot && boardIds.has(slot.unit.id)) result.add(slot.unit.id);
  }
  return result;
}

export const passiveGraftIds = computed<ReadonlySet<string>>(() => {
  if (selection.value) return EMPTY_SET;
  const boardIds = collectBoardIds();
  if (boardIds.size === 0) return EMPTY_SET;
  return collectMatchingShopIds(boardIds);
});

let resourceErrorTimer: ReturnType<typeof setTimeout> | null = null;

export function flashResourceError(resource: "blood" | "life") {
  if (resourceErrorTimer) clearTimeout(resourceErrorTimer);
  resourceError.value = resource;
  resourceErrorTimer = setTimeout(() => {
    resourceError.value = null;
    resourceErrorTimer = null;
  }, 500);
}

registry.push({
  reset() {
    if (resourceErrorTimer) {
      clearTimeout(resourceErrorTimer);
      resourceErrorTimer = null;
    }
  },
});

export function resetAllSignals() {
  batch(() => {
    for (const entry of registry) {
      entry.reset();
    }
  });
}
