import { signal } from "@preact/signals";
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

export const phase = signal<GamePhase>("TITLE");
export const origin = signal<OriginId | null>(null);
export const round = signal(1);
export const blood = signal(10);
export const sanity = signal(5);
export const trophy = signal(0);

export const board = signal<(UnitInstance | null)[]>([null, null, null, null, null]);
export const shopUnits = signal<(ShopSlot | null)[]>([]);
export const shopItems = signal<(ShopItemSlot | null)[]>([]);
export const selection = signal<Selection | null>(null);
export const freeRoll = signal(false);
export const cultistUsed = signal(false);
export const onboardingStep = signal<OnboardingStep>(null);
export const rotRingUses = signal(0);

export const currentEnemyTeam = signal<EnemyTeam | null>(null);
export const battleFrames = signal<BattleFrame[]>([]);
export const currentFrameIdx = signal(0);
export const battleResult = signal<BattleResult>(null);
export const fastForward = signal(false);
export const lastBattleResult = signal<BattleResult>(null);
export const lastEnemyTeamType = signal<EnemyFaction | null>(null);

export const currentRunId = signal<string | null>(null);
export const lastBattleId = signal<string | null>(null);
export const battleError = signal<InfraError | null>(null);

export const battleBusy = signal(false);
export const battleLoading = signal(false);
export const battleLoadError = signal<InfraError | null>(null);

export const gameLoading = signal(false);

export const canUndo = signal(false);
export const shopLocked = signal(false);
export const shopActionError = signal<InfraError | null>(null);
export const startGameError = signal<InfraError | null>(null);
export const activeEvent = signal<EventData | null>(null);
export const showHelpOverlay = signal(false);
