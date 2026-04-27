import type { RegularUnitId } from "../../shared/types";

export interface ShopNightLog {
  readonly night: number;
  readonly bought: readonly RegularUnitId[];
  readonly sold: readonly RegularUnitId[];
  readonly grafted: readonly { readonly target: RegularUnitId; readonly material: RegularUnitId }[];
  readonly foodPurchases: number;
  readonly equipPurchases: number;
  readonly rerolls: number;
  readonly bloodSpent: number;
  readonly rosterAtEndOfNight: readonly RegularUnitId[];
  readonly offers: readonly RegularUnitId[];
  readonly targetOffers: readonly RegularUnitId[];
}

export interface ShopHistory {
  readonly nights: readonly ShopNightLog[];
}
