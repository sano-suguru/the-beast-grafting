import { signal, batch, type Signal } from "@preact/signals";
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
export const sanity = resettableSignal(() => 5);
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
export const selection = resettableSignal<Selection | null>(() => null);
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

export function resetAllSignals() {
  batch(() => {
    for (const entry of registry) {
      entry.reset();
    }
  });
}
