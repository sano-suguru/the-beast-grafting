export type {
  EquipType,
  UnitData,
  UnitInstance,
  ItemData,
  OriginId,
  EventData,
  ShopSlot,
  ShopItemSlot,
  EnemyFaction,
  EnemyTeam,
  LogType,
  BattleAction,
  BattleLogEntry,
  BattleFrame,
  BattleResult,
} from "../../shared/types";

import type { UnitInstance, ItemData, ShopSlot, ShopItemSlot } from "../../shared/types";

export type GamePhase =
  | "TITLE"
  | "ORIGIN"
  | "SHOP"
  | "PRE_BATTLE"
  | "BATTLE_LOADING"
  | "BATTLE"
  | "RESULT"
  | "LORE";

export type Selection =
  | { type: "SHOP_UNIT"; index: number; item: UnitInstance }
  | { type: "SHOP_ITEM"; index: number; item: ItemData }
  | { type: "BOARD_UNIT"; index: number; item: UnitInstance };

export type HighlightKind = "graft" | "swap" | "move" | false;

export type OnboardingStep = "buy" | "graft" | "roll" | "battle" | null;

export interface ShopSnapshot {
  blood: number;
  sanity: number;
  trophy: number;
  board: (UnitInstance | null)[];
  shopUnits: (ShopSlot | null)[];
  shopItems: (ShopItemSlot | null)[];
  freeRoll: boolean;
  cultistUsed: boolean;
  onboardingStep: OnboardingStep;
  rotRingUses: number;
}

export interface LoreEntry {
  seen: boolean;
  mastered: boolean;
}

export type LoreDb = Record<string, LoreEntry>;

export type SoundType =
  | "select"
  | "error"
  | "buy"
  | "graft"
  | "clash"
  | "damage"
  | "defend"
  | "skill"
  | "death";
