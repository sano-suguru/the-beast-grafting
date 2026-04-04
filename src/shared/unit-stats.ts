import type { UnitInstance } from "./types";

type HasStats = Pick<UnitInstance, "baseAtk" | "baseHp" | "buffAtk" | "buffHp">;

export const effectiveAtk = (u: HasStats): number => u.baseAtk + u.buffAtk;
export const effectiveHp = (u: HasStats): number => u.baseHp + u.buffHp;
