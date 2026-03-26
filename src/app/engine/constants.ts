// --- ショップ ---
export const UNIT_COST = 3;

// --- バトル制限 ---
export const DEATH_CASCADE_LIMIT = 20;
export const COMBAT_ROUND_LIMIT = 500;
/** 無限ループ防止用安全上限。死亡アニメフレーム等の視覚フレームを含め余裕を持たせる */
export const MAX_OPS = 15_000;
export const FLY_SPAWN_CAP = 3;
export const HUNDRED_ARMS_SAFETY = 10;

// --- トークンステータス ---
export const HOUND_TOKEN = { atk: 1, hp: 1 } as const;
export const BEAST_SUMMON = { atk: 2, hp: 2 } as const;
export const CHURCH_BEAST_TOKEN = { atk: 2, hp: 2 } as const;
export const FLY_TOKEN = { atk: 4, hp: 4 } as const;
export const MAGGOT_TOKEN = { atk: 1, hp: 1 } as const;
export const DEATH_CURSE_TOKEN = { atk: 1, hp: 1 } as const;

// --- スキル値 ---
export const BAT_DAMAGE = 1;
export const BANSHEE_DAMAGE = 8;
export const EVANGELIST_HP_RATIO = 0.33;
export const PARASITE_BUFF = { atk: 2, hp: 2 } as const;
export const EYE_DAMAGE = 5;
export const EYE_INITIAL_USES = 5;
export const CHOLERA_INITIAL_USES = 1;
export const ACID_SPLASH_DAMAGE = 5;
export const BERSERK_BONUS = 3;
export const INFECTION_EXTRA_DAMAGE = 3;
export const NUMBNESS_REDUCTION = 7;
export const NUMBNESS_INITIAL_USES = 2;
export const CORPSE_WAX_REDUCTION = 20;
export const IRON_REDUCTION = 2;
export const MIN_EQUIPMENT_DAMAGE = 2;
export const ALTAR_BUFF = { atk: 3, hp: 1 } as const;
export const HUNDRED_ARMS_T1_DAMAGE = 8;
export const HUNDRED_ARMS_DEFAULT_DAMAGE = 4;
export const REVENANT_MAX_TARGETS = 3;
export const ROT_RING_MAX_USES = 4;
export const MACHINE_BUFF = { atk: 2, hp: 2 } as const;

// --- アニメーション (ms) ---
export const FRAME_DELAY_NORMAL = 700;
export const FRAME_DELAY_FAST = 150;
export const FRAME_DELAY_DEATH_CHAIN = 300;
