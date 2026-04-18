import type { EnemyFaction } from "./enemy-faction";
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

/** UnitInstance から secretLore を除き、id を string に広げたシリアライズ用型 */
export type BoardUnit = Omit<UnitInstance, "id" | "secretLore"> & { id: string };

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
  const { secretLore: _secretLore, ...boardUnit } = u;
  return boardUnit;
}

export function boardUnitToUnitInstance(bu: BoardUnit): UnitInstance {
  const master = lookupUnitData(bu.id as DataUnitId);
  invariant(master, `unknown unit id "${bu.id}" (isChurch=${bu.isChurch})`);
  const inst: UnitInstance = {
    ...bu,
    id: bu.id as UnitId,
    tempBuffAtk: bu.tempBuffAtk ?? 0,
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
  if (pvp.night != null) {
    return { ...base, night: pvp.night, life: pvp.life, trophy: pvp.trophy };
  }
  return { ...base, night: null, life: null, trophy: null };
}
