import type { MAX_UNIT_LEVEL } from "./constants";
import type { UnitId } from "./types";
import { invariant } from "./invariant";

type Tuple<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? readonly [...R]
  : Tuple<T, N, [T, ...R]>;

/** MAX_UNIT_LEVEL 要素のタプル。要素数は MAX_UNIT_LEVEL から自動導出 */
type Scaled<T> = Tuple<T, typeof MAX_UNIT_LEVEL>;

export function atLevel<T>(values: Scaled<T>, level: number): T {
  invariant(level >= 1 && level <= values.length, `atLevel: level ${level} out of range`);
  return values[level - 1]!;
}

export type Buff = { readonly atk: number; readonly hp: number };
type SN = Scaled<number>;
type SB = Scaled<Buff>;

// ── 開戦スキル ──

export const BAT = {
  damage: [1, 1, 1] as SN,
  targets: [1, 2, 3] as SN,
};

export const INQUISITOR = {
  damage: [1, 2, 3] as SN,
};

export const BANSHEE = {
  damage: [8, 16, 24] as SN,
};

export const REVENANT = {
  targets: [3, 4, 5] as SN,
  buff: [1, 2, 3] as SN,
};

// ── 攻撃前スキル ──

export const CHOLERA = {
  uses: [1, 2, 3] as SN,
};

export const PARASITE = {
  buff: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const EYE = {
  damage: [5, 10, 15] as SN,
  uses: [5, 7, 9] as SN,
};

// ── 被弾スキル ──

export const TEMPLAR = {
  atkBuff: [1, 2, 3] as SN,
};

// ── 戦闘スキル ──

export const HUNDRED_ARMS = {
  damageT1: [8, 16, 24] as SN,
  damageDefault: [4, 8, 12] as SN,
};

// ── 死亡スキル ──

export const RAT = {
  deathBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const SQUIRE = {
  deathBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const MARTYR = {
  deathBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const PRIEST = {
  deathBuff: [
    { atk: 0, hp: 1 },
    { atk: 0, hp: 2 },
    { atk: 0, hp: 3 },
  ] as SB,
};

export const HOUND = {
  token: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const BEAST = {
  summon: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const CHURCH_BEAST = {
  token: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const EVANGELIST = {
  damage: [3, 6, 9] as SN,
};

export const BEELZEBUB = {
  token: [
    { atk: 4, hp: 4 },
    { atk: 8, hp: 8 },
    { atk: 12, hp: 12 },
  ] as SB,
};

// ── ショップスキル ──

export const ALTAR = {
  buff: [
    { atk: 3, hp: 1 },
    { atk: 6, hp: 2 },
    { atk: 9, hp: 3 },
  ] as SB,
};

export const MACHINE = {
  buff: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const ZEALOT = {
  summonBuff: [1, 2, 3] as SN,
};

export const ROT_RING = {
  uses: [4, 5, 6] as SN,
};

/** 売却時の血液獲得量（レベル + beggarボーナス） */
export function sellBloodGain(level: number, id: UnitId): number {
  return level + (id === "beggar" ? 1 : 0);
}
