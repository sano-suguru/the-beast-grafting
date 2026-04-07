import type { EquipType } from "./equip-type";
import type { OriginId } from "./origin-id";
import type { EnemyFaction } from "./enemy-faction";
import type { Tier } from "./data/tiers";
export type { EquipType, OriginId, EnemyFaction, Tier };

export type RegularUnitId =
  | "rat"
  | "beggar"
  | "hound"
  | "bat"
  | "zealot"
  | "martyr"
  | "beast"
  | "cholera"
  | "parasite"
  | "maiden"
  | "revenant"
  | "evangelist"
  | "altar"
  | "machine"
  | "shrieking_throat"
  | "hundred_arms"
  | "chalice"
  | "brains"
  | "eye"
  | "beelzebub"
  | "rot_ring";

export type ChurchUnitId =
  | "squire"
  | "inquisitor"
  | "church_hound"
  | "priest"
  | "templar"
  | "church_beast";

export type TokenId = "token";
export type UnitId = RegularUnitId | ChurchUnitId | TokenId;

export type ItemId =
  | "preservative"
  | "iron_plate"
  | "bile"
  | "maggot"
  | "numbness"
  | "acid_blood"
  | "corpse_wax"
  | "death_curse"
  | "pure_blood";

export interface UnitData {
  id: RegularUnitId | ChurchUnitId;
  name: string;
  baseAtk: number;
  baseHp: number;
  tier: Tier;
  skillText: string;
  lore: string;
  secretLore?: string;
}

export interface UnitInstance {
  id: UnitId;
  name: string;
  baseAtk: number;
  baseHp: number;
  buffAtk: number;
  buffHp: number;
  tier: Tier;
  skillText: string;
  lore: string;
  secretLore?: string;
  level: number;
  exp: number;
  equip: EquipType | null;
  uid: string;
  isChurch: boolean;
}

export interface ItemData {
  id: ItemId;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  equip: EquipType | null;
  skillText: string;
  lore: string;
}

export interface OriginData {
  id: OriginId;
  name: string;
  desc: string;
  lore: string;
  icon: string;
}

export type EventId = "vial" | "surplus" | "rotting_cargo" | "quiet_night" | "patrol";

export interface EventUnitOffer {
  unitId: RegularUnitId | "random";
  tier?: Tier;
  cost: number;
  equipOverride?: EquipType;
  atkBonus: number;
  hpBonus: number;
}

export interface EventItemOffer {
  itemId: ItemId | "random";
  cost: number;
}

export interface EventData {
  id: EventId;
  name: string;
  narrative: string;
  unitOffers: EventUnitOffer[];
  itemOffers: EventItemOffer[];
  bloodBonus: number;
  shopUnitBuff: { atk: number; hp: number } | null;
  shopSizeModifier: number;
  freeRoll: boolean;
  lockRoll: boolean;
}

export interface ShopSlot {
  unit: UnitInstance;
  frozen: boolean;
  costOverride?: number;
  eventSourced: boolean;
}

export interface ShopItemSlot {
  item: ItemData;
  frozen: boolean;
}

export type LifeTier = "high" | "mid" | "low";

export function toLifeTier(life: number): LifeTier {
  if (life >= 4) return "high";
  if (life >= 2) return "mid";
  return "low";
}

export interface PreBattleText {
  readonly intro: string;
  readonly closing: string;
}

export type OpponentStatsKnown = { round: number; life: number; trophy: number };
export type OpponentStats = OpponentStatsKnown | { round: null; life: null; trophy: null };

export type EnemyTeam = {
  teamName: string;
  teamType: EnemyFaction;
  units: UnitInstance[];
} & OpponentStats;

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
  /** ダメージを与えたユニットのuid */
  source?: string;
}

export type LogSegmentKind = "unit" | "effect" | "stat" | "hp";
export type LogSegment = string | { kind: LogSegmentKind; text: string };

export interface BattleLogEntry {
  id: string;
  type: LogType;
  segments: LogSegment[];
  icon: IconType;
}

export interface BattleUnitSnapshot extends UnitInstance {
  /** 戦闘中の現在攻撃力（base + buff + 戦闘中バフ） */
  atk: number;
  /** 戦闘中の現在HP（base + buff + 戦闘中バフ - 被ダメージ） */
  hp: number;
  /** 戦闘開始時の攻撃力（戦闘中バフ適用前） */
  battleBaseAtk: number;
  /** 戦闘開始時のHP（戦闘中バフ適用前） */
  battleBaseHp: number;
}

export interface BattleFrame {
  pBoard: BattleUnitSnapshot[];
  eBoard: BattleUnitSnapshot[];
  log: BattleLogEntry;
  actions: Record<string, BattleAction>;
  /** フレーム再生遅延 (ms)。未指定なら通常速度 */
  delay?: number;
}

export type BattleResult = "WIN" | "LOSE" | "DRAW" | null;

export interface EquipInfo {
  name: string;
  desc: string;
}
