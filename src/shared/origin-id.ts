export const ORIGIN_IDS = ["thief", "inquisitor", "surgeon", "cultist"] as const;

export type OriginId = (typeof ORIGIN_IDS)[number];

const originIdSet: ReadonlySet<string> = new Set(ORIGIN_IDS);

export function isOriginId(value: unknown): value is OriginId {
  return typeof value === "string" && originIdSet.has(value);
}
