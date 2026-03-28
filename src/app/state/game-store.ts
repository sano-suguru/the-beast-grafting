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
  ShopSnapshot,
  EventData,
} from "../types";

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

export const undoSnapshot = signal<ShopSnapshot | null>(null);
export const activeEvent = signal<EventData | null>(null);
export const showHelpOverlay = signal(false);
