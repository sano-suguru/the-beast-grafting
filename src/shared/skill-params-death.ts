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

export const GROANING_COFFIN = {
  token: [
    { atk: 5, hp: 3 },
    { atk: 10, hp: 6 },
    { atk: 15, hp: 9 },
  ] as SB,
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
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const STELLAR_COCOON = {
  count: [1, 2, 3] as SN,
};

export const MAIDEN = {
  targets: [1, 2, 3] as SN,
};

/** cholera: Faint – 全ペットにダメージ */
export const CHOLERA = {
  damage: [2, 4, 6] as SN,
};

/** devouring_wound: Faint – 敵側に1/1トークン召喚 */
export const DEVOURING_WOUND = {
  token: { atk: 1, hp: 1 },
  uses: [1, 2, 3] as SN,
};

/** spite_beast: Faint – 隣接ユニット(後方味方+敵最前衛)に攻撃のN%ダメージ */
export const SPITE_BEAST = {
  percent: [50, 100, 150] as SN,
};
