import type { EquipType } from "./equip-type";
import type { EnemyFaction } from "./enemy-faction";
import type { Tier } from "./data/tiers";
import type {
  UnitInstance,
  UnitId,
  DataUnitId,
  EnemyTeam,
  OpponentStats,
  OpponentStatsKnown,
} from "./types";
import { lookupUnitData } from "./data/unit-lookup";
import { invariant } from "./invariant";

export interface BoardUnit {
  id: string;
  name: string;
  baseAtk: number;
  baseHp: number;
  buffAtk: number;
  buffHp: number;
  tier: Tier;
  level: number;
  exp: number;
  equip: EquipType | null;
  uid: string;
  isChurch: boolean;
  skillText: string;
  lore: string;
}

export type PvpOpponent = {
  playerId: string | null;
  teamName: string;
  teamType: EnemyFaction;
  units: BoardUnit[];
} & OpponentStats;

export type MatchedOpponent = {
  playerId: string;
  teamName: string;
  teamType: EnemyFaction;
  units: BoardUnit[];
} & OpponentStatsKnown;

export function unitInstanceToBoardUnit(u: UnitInstance): BoardUnit {
  return {
    id: u.id,
    name: u.name,
    baseAtk: u.baseAtk,
    baseHp: u.baseHp,
    buffAtk: u.buffAtk,
    buffHp: u.buffHp,
    tier: u.tier,
    level: u.level,
    exp: u.exp,
    equip: u.equip,
    uid: u.uid,
    isChurch: u.isChurch,
    skillText: u.skillText,
    lore: u.lore,
  };
}

export function boardUnitToUnitInstance(bu: BoardUnit): UnitInstance {
  const master = lookupUnitData(bu.id as DataUnitId);
  invariant(master, `unknown unit id "${bu.id}" (isChurch=${bu.isChurch})`);
  const inst: UnitInstance = {
    id: bu.id as UnitId,
    name: bu.name,
    baseAtk: bu.baseAtk,
    baseHp: bu.baseHp,
    buffAtk: bu.buffAtk,
    buffHp: bu.buffHp,
    tier: bu.tier,
    level: bu.level,
    exp: bu.exp,
    equip: bu.equip,
    uid: bu.uid,
    isChurch: bu.isChurch,
    skillText: bu.skillText,
    lore: bu.lore,
  };
  if (master.secretLore) inst.secretLore = master.secretLore;
  return inst;
}

export function pvpOpponentToEnemyTeam(pvp: PvpOpponent): EnemyTeam {
  const base = {
    teamName: pvp.teamName,
    teamType: pvp.teamType,
    units: pvp.units.map(boardUnitToUnitInstance),
  };
  if (pvp.round != null) {
    return { ...base, round: pvp.round, life: pvp.life, trophy: pvp.trophy };
  }
  return { ...base, round: null, life: null, trophy: null };
}
