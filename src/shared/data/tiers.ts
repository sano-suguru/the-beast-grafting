export const TIERS = [1, 2, 3, 4, 5, 6] as const;
export type Tier = (typeof TIERS)[number];

export const UNLOCKABLE_TIERS = [2, 3, 4, 5, 6] as const;
export type UnlockableTier = (typeof UNLOCKABLE_TIERS)[number];

export const TIER_UNLOCK_TEXT: Readonly<Record<UnlockableTier, string>> = {
  2: "焦げた髪の臭いが地下まで漂ってきた。火刑台の残りが、今夜の荷に紛れている。",
  3: "木箱の中で何かが蠢いている。釘を打ち直しても、内側から軋み続けていた。",
  4: "運び屋の手が震えていた。荷を置いた途端、二度と来ないと言い残して消えた。",
  5: "今夜は運び屋が来なかった。代わりに、荷だけが地下の入口に転がっていた。",
  6: "地下の蝋燭が一斉に消えた。闇の中で、新しい荷が脈打っている。",
};

/** SAPではトークン（召喚物）は一律Tier 1として扱われる */
export const TOKEN_TIER: Tier = 1;

const NEXT: Record<Tier, Tier> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 };
export const nextTier = (t: Tier): Tier => NEXT[t];

export function getCurrentMaxTier(round: number): Tier {
  if (round >= 11) return 6;
  if (round >= 9) return 5;
  if (round >= 7) return 4;
  if (round >= 5) return 3;
  if (round >= 3) return 2;
  return 1;
}

export function detectTierUnlock(prevRound: number, nextRound: number): UnlockableTier | null {
  const prev = getCurrentMaxTier(prevRound);
  const next = getCurrentMaxTier(nextRound);
  return next > prev ? (next as UnlockableTier) : null;
}
