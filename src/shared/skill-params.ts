import type { MAX_UNIT_LEVEL } from "./constants";
import { invariant } from "./invariant";

type Tuple<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? readonly [...R]
  : Tuple<T, N, [T, ...R]>;

/** MAX_UNIT_LEVEL 要素のタプル。要素数は MAX_UNIT_LEVEL から自動導出 */
export type Scaled<T> = Tuple<T, typeof MAX_UNIT_LEVEL>;

export function atLevel<T>(values: Scaled<T>, level: number): T {
  invariant(level >= 1 && level <= values.length, `atLevel: level ${level} out of range`);
  return values[level - 1]!;
}

export type Buff = { readonly atk: number; readonly hp: number };
type SN = Scaled<number>;
type SB = Scaled<Buff>;

// ── 開戦スキル ──

export const BAT = {
  damage: [1, 1, 1] as SN, // targets がスケールするためダメージは固定
  targets: [1, 2, 3] as SN,
};

export const INQUISITOR = {
  damage: [1, 2, 3] as SN,
};

export const BANSHEE = {
  damage: [6, 12, 18] as SN,
  selfDamage: [3, 6, 9] as SN,
};

export const REVENANT = {
  targets: [1, 2, 3] as SN,
  buff: { atk: 1, hp: 1 },
};

export const PALADIN = {
  hpBuff: [1, 2, 3] as SN,
};

export const HOLY_FIRE = {
  damage: [10, 15, 20] as SN,
};

/** market_vulture: SoB – 最高HP味方のHP × percent% を自身HPに加算 */
export const MARKET_VULTURE = {
  percent: [25, 50, 75] as SN,
};

// ── 攻撃前スキル ──

export const PARASITE = {
  buff: [
    { atk: 2, hp: 1 },
    { atk: 4, hp: 2 },
    { atk: 6, hp: 3 },
  ] as SB,
};

export const EYE = {
  damage: [5, 10, 15] as SN,
  uses: [5, 5, 5] as SN,
};

export const FAMINE_CORPSE = {
  damage: 4,
  uses: [1, 2, 3] as SN,
};

export const RELIC_SWORD = {
  atkBuff: [2, 4, 6] as SN,
};

export const PLAGUE_BELL = {
  damage: [1, 1, 1] as SN, // AoE + uses がスケールするためダメージは固定
  uses: [4, 6, 8] as SN,
};

// ── 被弾スキル ──

export const TUMOR_GUARDIAN = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const TEMPLAR = {
  atkBuff: [1, 2, 3] as SN,
};

export const STITCHED_TWIN = {
  atkBuff: [3, 6, 9] as SN,
};

export const FLAYED_SAINT = {
  buff: [
    { atk: 1, hp: 2 },
    { atk: 2, hp: 4 },
    { atk: 3, hp: 6 },
  ] as SB,
};

export const FLAGELLANT = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 1 },
    { atk: 2, hp: 2 },
  ] as SB,
};

export const HOWLING_GIANT = {
  atkBuff: [1, 2, 3] as SN,
};

export const AMNIOTIC_ARMOR = {
  uses: [2, 3, 4] as SN,
};

export const MACHINE = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 1, hp: 2 },
    { atk: 2, hp: 2 },
  ] as SB,
  uses: [3, 3, 3] as SN,
};

// ── 戦闘スキル（撃破） ──

export const HUNDRED_ARMS = {
  damageT1: [8, 16, 24] as SN,
  damageDefault: [4, 8, 12] as SN,
};

export const ORGAN_GRINDER = {
  damage: [2, 4, 6] as SN,
};

export const RISEN_POPE = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

// ── 死亡スキル ──
export {
  RAT,
  SQUIRE,
  MARTYR,
  PRIEST,
  HOUND,
  BEAST,
  CHURCH_BEAST,
  MAIDEN,
  HANGED_MAN,
  SERAPH,
  EVANGELIST,
  SIN_EATER,
  CATHEDRAL,
  BEELZEBUB,
  OMEN_WOMB,
  STELLAR_COCOON,
  DEVOURING_GRAFT,
  CHOLERA,
  DEVOURING_WOUND,
  SPITE_BEAST,
} from "./skill-params-death";

// ── Avengeスキル ──

export const GRINNING_SKULL = {
  threshold: 3,
  buff: [
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
    { atk: 5, hp: 5 },
  ] as SB,
  uses: [2, 3, 4] as SN,
};

export const ARCHANGEL = {
  threshold: 2,
  buff: [
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
    { atk: 8, hp: 8 },
  ] as SB,
};

export const GROANING_COFFIN = {
  threshold: 2,
  damage: [3, 5, 7] as SN,
};

export const WAILING_CURSECHILD = {
  threshold: 3,
  buff: [
    { atk: 1, hp: 2 },
    { atk: 2, hp: 3 },
    { atk: 3, hp: 4 },
  ] as SB,
  uses: [1, 2, 3] as SN,
};

// ── 攻撃後スキル ──

export const NEEDLESHELL_WORM = {
  targets: [1, 2, 3] as SN,
};

// ── 開戦バフ ──

export const CORRODING_MOLD = {
  percent: [50, 100, 150] as SN,
};

// ── 味方前衛攻撃リアクション ──

/** crawling_cord: 前方味方攻撃時に自身バフ */
export const CRAWLING_CORD = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const INSATIABLE_MAW = {
  buff: [
    { atk: 2, hp: 1 },
    { atk: 3, hp: 2 },
    { atk: 4, hp: 3 },
  ] as SB,
  uses: [2, 3, 4] as SN,
};

// ── 味方死亡リアクション ──

/** carrion_sentinel: 前の味方が死亡 → 屍蝋の盾 + ATK+1 */
export const CARRION_SENTINEL = {
  uses: [1, 2, 3] as SN,
};

// ── ショップスキル ──
export {
  ALTAR,
  ZEALOT,
  ROT_RING,
  BUDDING_HYDRA,
  BONE_TREE,
  ASH_FUNGUS,
  TAINTED_PLACENTA,
  CORPSE_BROKER,
  CHALICE,
  GUT_HAND,
  BONE_JAW,
  ROT_FEEDER,
  CORPSE_PECKER,
  NESTING_GRUB,
  CATACOMB_RAT,
  GRAFT_SCION,
  sellBloodGain,
} from "./skill-params-shop";
