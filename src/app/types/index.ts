// --- Game Phase ---
export type GamePhase =
  | "TITLE"
  | "ORIGIN"
  | "SHOP"
  | "PRE_BATTLE"
  | "BATTLE_LOADING"
  | "BATTLE"
  | "RESULT"
  | "LORE";

// --- Unit ---
export type UnitId = string;

export interface UnitData {
  id: UnitId;
  name: string;
  baseAtk: number;
  baseHp: number;
  tier: number;
  skillText: string;
  lore: string;
  secretLore?: string;
}

export interface UnitInstance {
  id: UnitId;
  name: string;
  baseAtk: number;
  baseHp: number;
  tier: number;
  skillText: string;
  lore: string;
  secretLore?: string;
  atk: number;
  hp: number;
  level: number;
  exp: number;
  equip: EquipId;
  uid: string;
  isChurch: boolean;
}

export type EquipType =
  | "iron"
  | "berserk"
  | "corpse_wax"
  | "infection"
  | "maggot_nest"
  | "numbness"
  | "acid"
  | "death_curse";

export type EquipId = EquipType | null;

// --- Item ---
export interface ItemData {
  id: string;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  equip: EquipId;
  skillText: string;
  lore: string;
}

// --- Origin ---
export type OriginId = "thief" | "inquisitor" | "surgeon" | "cultist";

export interface OriginData {
  id: OriginId;
  name: string;
  desc: string;
  lore: string;
}

// --- Shop ---
export interface ShopSlot {
  unit: UnitInstance;
  frozen: boolean;
}

export interface ShopItemSlot {
  item: ItemData;
  frozen: boolean;
}

export type Selection =
  | { type: "SHOP_UNIT"; index: number; item: UnitInstance }
  | { type: "SHOP_ITEM"; index: number; item: ItemData }
  | { type: "BOARD_UNIT"; index: number; item: UnitInstance };

export type HighlightKind = "graft" | "swap" | "move" | false;

export type OnboardingStep = "buy" | "graft" | "roll" | "battle" | null;

// --- Enemy ---
export interface EnemyTeam {
  teamName: string;
  teamType: string;
  units: UnitInstance[];
}

// --- Battle ---
export type LogType = "info" | "clash" | "damage" | "skill" | "death" | "defend" | "result";
export type IconType =
  | "info"
  | "clash"
  | "damage"
  | "skill"
  | "death"
  | "defend"
  | "trophy"
  | "skull";

export interface BattleAction {
  type: "clash" | "damage" | "buff" | "heal" | "skill" | "defend" | "summon" | "death";
  value?: string;
}

export interface BattleLogEntry {
  id: string;
  type: LogType;
  text: string;
  icon: IconType;
}

export interface BattleFrame {
  pBoard: UnitInstance[];
  eBoard: UnitInstance[];
  log: BattleLogEntry;
  actions: Record<string, BattleAction>;
  /** フレーム再生遅延 (ms)。未指定なら通常速度 */
  delay?: number;
}

export type BattleResult = "WIN" | "LOSE" | "DRAW" | null;

// --- Undo ---
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

// --- Lore ---
export interface LoreEntry {
  seen: boolean;
  mastered: boolean;
}

export type LoreDb = Record<string, LoreEntry>;

// --- Sound ---
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

// --- Equip Info ---
export interface EquipInfo {
  name: string;
  desc: string;
}
