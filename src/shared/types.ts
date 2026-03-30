import type { EquipType } from "./equip-type";
import type { OriginId } from "./origin-id";
import type { EnemyFaction } from "./enemy-faction";
export type { EquipType, OriginId, EnemyFaction };

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
}

export type EventId = "vial" | "surplus" | "rotting_cargo" | "quiet_night" | "patrol";

export interface EventUnitOffer {
  unitId: RegularUnitId | "random";
  tier?: number;
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
  replacesShopUnits: boolean;
}

export interface ShopSlot {
  unit: UnitInstance;
  frozen: boolean;
  costOverride?: number;
}

export interface ShopItemSlot {
  item: ItemData;
  frozen: boolean;
}

export type SanityTier = "high" | "mid" | "low";

export interface PreBattleText {
  readonly intro: string;
  readonly closing: string;
}

export interface EnemyTeam {
  teamName: string;
  teamType: EnemyFaction;
  units: UnitInstance[];
}

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

export interface EquipInfo {
  name: string;
  desc: string;
}
