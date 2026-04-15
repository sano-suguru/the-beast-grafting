import type { Buff, Scaled } from "./skill-params";
import type { UnitId } from "./types";

type SN = Scaled<number>;
type SB = Scaled<Buff>;

export const ALTAR = {
  buff: [
    { atk: 2, hp: 1 },
    { atk: 3, hp: 2 },
    { atk: 5, hp: 3 },
  ] as SB,
};

export const ZEALOT = {
  summonBuff: [1, 2, 3] as SN,
};

export const ROT_RING = {
  uses: [4, 5, 6] as SN,
};

export const BLOOD_FONT = {
  hpBuff: [3, 5, 7] as SN,
};

export const BUDDING_HYDRA = {
  divisor: [5, 4, 3] as SN,
  token: [
    { atk: 3, hp: 3 },
    { atk: 4, hp: 4 },
    { atk: 5, hp: 5 },
  ] as SB,
};

export const BONE_TREE = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
  ] as SB,
};

export const GRAVE_WORM = {
  sellBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const MARKET_VULTURE = {
  shopBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 1 },
    { atk: 2, hp: 2 },
  ] as SB,
};

export const ASH_FUNGUS = {
  percent: [25, 33, 50] as SN,
};

export const GHOUL_INFANT = {
  atkBuff: [1, 2, 3] as SN,
};

export const TAINTED_PLACENTA = {
  shopBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const CORPSE_BROKER = {
  sellBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

/** 売却時の血液獲得量（レベル + beggarボーナス） */
export function sellBloodGain(level: number, id: UnitId): number {
  return level + (id === "beggar" ? 1 : 0);
}
