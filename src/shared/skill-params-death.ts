import type { Buff, Scaled } from "./skill-params";

type SN = Scaled<number>;
type SB = Scaled<Buff>;

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
    { atk: 3, hp: 3 },
    { atk: 5, hp: 5 },
    { atk: 8, hp: 8 },
  ] as SB,
};

export const HANGED_MAN = {
  targets: [3, 4, 5] as SN,
};

export const SERAPH = {
  deathBuff: [
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
    { atk: 5, hp: 5 },
  ] as SB,
};

export const EVANGELIST = {
  targets: [1, 1, 2] as SN,
  uses: [1, 2, 3] as SN,
};

export const CROW = {
  buff: [
    { atk: 1, hp: 0 },
    { atk: 1, hp: 1 },
    { atk: 1, hp: 2 },
  ] as SB,
  uses: [2, 3, 4] as SN,
};

export const SIN_EATER = {
  atkCap: [4, 8, 12] as SN,
  uses: [3, 4, 5] as SN,
};

export const CATHEDRAL = {
  token: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
  uses: [2, 2, 2] as SN, // token stats がスケールするため召喚回数は固定
};

export const BEELZEBUB = {
  token: [
    { atk: 4, hp: 4 },
    { atk: 8, hp: 8 },
    { atk: 12, hp: 12 },
  ] as SB,
  uses: [3, 3, 3] as SN,
};

export const OMEN_WOMB = {
  token: [
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
    { atk: 4, hp: 4 },
  ] as SB,
};

export const STELLAR_COCOON = {
  summon: [
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
    { atk: 4, hp: 4 },
  ] as SB,
};

export const MAIDEN = {
  targets: [1, 2, 3] as SN,
};

export const DEVOURING_GRAFT = {
  absorbPercent: [70, 85, 100] as SN,
  decayPercent: [30, 40, 50] as SN,
};
