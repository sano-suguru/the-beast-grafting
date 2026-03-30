import type { EquipType } from "./equip-type";
import type { EnemyFaction } from "./enemy-faction";
import type { UnitInstance, UnitId, RegularUnitId, ChurchUnitId, EnemyTeam } from "./types";
import { UNITS } from "./data/units";
import { CHURCH_UNITS } from "./data/church-units";
import { invariant } from "./invariant";

export interface BoardUnit {
  id: string;
  name: string;
  baseAtk: number;
  baseHp: number;
  atk: number;
  hp: number;
  tier: number;
  level: number;
  exp: number;
  equip: EquipType | null;
  uid: string;
  isChurch: boolean;
  skillText: string;
  lore: string;
}

export interface PvpOpponent {
  playerId: string | null;
  teamName: string;
  teamType: EnemyFaction;
  units: BoardUnit[];
}

export function unitInstanceToBoardUnit(u: UnitInstance): BoardUnit {
  return {
    id: u.id,
    name: u.name,
    baseAtk: u.baseAtk,
    baseHp: u.baseHp,
    atk: u.atk,
    hp: u.hp,
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
  const master = bu.isChurch ? CHURCH_UNITS[bu.id as ChurchUnitId] : UNITS[bu.id as RegularUnitId];
  invariant(master, `unknown unit id "${bu.id}" (isChurch=${bu.isChurch})`);
  const inst: UnitInstance = {
    id: bu.id as UnitId,
    name: bu.name,
    baseAtk: bu.baseAtk,
    baseHp: bu.baseHp,
    atk: bu.atk,
    hp: bu.hp,
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
  return {
    teamName: pvp.teamName,
    teamType: pvp.teamType,
    units: pvp.units.map(boardUnitToUnitInstance),
  };
}
