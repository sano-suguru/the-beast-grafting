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
  LogSegmentKind,
  LogSegment,
  BattleAction,
  BattleLogEntry,
  BattleUnitSnapshot,
  BattleFrame,
  BattleResult,
} from "../../shared/types";

import type { UnitInstance, ItemData } from "../../shared/types";

export type GamePhase =
  | "TITLE"
  | "ORIGIN"
  | "SHOP"
  | "PRE_BATTLE"
  | "BATTLE"
  | "BATTLE_RESULT"
  | "RESULT"
  | "LORE";

export type Selection =
  | { type: "SHOP_UNIT"; index: number; item: UnitInstance }
  | { type: "SHOP_ITEM"; index: number; item: ItemData }
  | { type: "BOARD_UNIT"; index: number; item: UnitInstance }
  | { type: "REWARD_UNIT"; index: number; item: UnitInstance };

export type HighlightKind = "graft" | "swap" | "move" | "passive-graft" | false;

export type OnboardingStep = "buy" | "graft" | "roll" | "battle" | null;

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
