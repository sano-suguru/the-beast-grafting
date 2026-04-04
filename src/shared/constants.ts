export const UNIT_COST = 3;
export const MAX_UNIT_LEVEL = 3;

/** SAP準拠: Lv2に2exp、Lv3にさらに3exp（累積5exp） */
export const CUMULATIVE_EXP = { 2: 2, 3: 5 } as const;

/** 各レベル内の必要exp数（expバー表示用） */
export const expPerLevel = (level: number): number => (level === 1 ? 2 : 3);
