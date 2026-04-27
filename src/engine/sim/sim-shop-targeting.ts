import type { UnitInstance } from "../../shared/types";
import type { Rng } from "../rng";
import { shuffleAndTakeN } from "../helpers";

function carryScore(unit: UnitInstance): number {
  return (unit.baseAtk + unit.buffAtk) * 1.2 + (unit.baseHp + unit.buffHp) + unit.level * 2;
}

export function selectCarryTargets(
  team: readonly UnitInstance[],
  excludedUid: string,
  count: number,
): UnitInstance[] {
  const preferred = team
    .filter((unit) => unit.uid !== excludedUid)
    .slice()
    .sort((a, b) => carryScore(b) - carryScore(a))
    .slice(0, count);
  if (preferred.length > 0) return preferred;
  return team
    .slice()
    .sort((a, b) => carryScore(b) - carryScore(a))
    .slice(0, count);
}

export function distributeBuffRandomly(
  team: UnitInstance[],
  atk: number,
  hp: number,
  rng: Rng,
): void {
  if (team.length === 0) return;
  const perUnitAtk = Math.floor(atk / team.length);
  const perUnitHp = Math.floor(hp / team.length);
  for (const u of team) {
    u.buffAtk += perUnitAtk;
    u.buffHp += perUnitHp;
  }
  const remainder = { atk: atk - perUnitAtk * team.length, hp: hp - perUnitHp * team.length };
  if (remainder.atk > 0 || remainder.hp > 0) {
    const target = team[Math.floor(rng.next() * team.length)]!;
    target.buffAtk += remainder.atk;
    target.buffHp += remainder.hp;
  }
}

export function pickDistinctTargets(
  team: readonly UnitInstance[],
  count: number,
  rng: Rng,
  excludedUid?: string,
): UnitInstance[] {
  const pool = team.filter((unit) => unit.uid !== excludedUid);
  return shuffleAndTakeN(pool, count, rng);
}

export function estimateTeamWinRate(team: readonly UnitInstance[], night: number): number {
  if (team.length === 0) return 0.5;
  const power = team.reduce((s, u) => s + (u.baseAtk + u.buffAtk) + (u.baseHp + u.buffHp) * 0.7, 0);
  const baseline = 45 + night * 2.5;
  const scale = 20;
  const z = (power - baseline) / scale;
  return 1 / (1 + Math.exp(-z));
}

export function levelFraction(team: readonly UnitInstance[], targetLevel: number): number {
  if (team.length === 0) return 0;
  const count = team.reduce((s, u) => s + (u.level >= targetLevel ? 1 : 0), 0);
  return count / team.length;
}
