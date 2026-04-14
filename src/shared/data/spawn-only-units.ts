import type { SpawnOnlyUnitId, UnitData } from "../types";

export const SPAWN_ONLY_UNITS: Record<SpawnOnlyUnitId, UnitData> = {
  star_child: {
    id: "star_child",
    name: "星の落とし子",
    baseAtk: 3,
    baseHp: 3,
    tier: 4,
    skillText: "死亡: 自身を倒した敵が錯乱し、ランダムな敵を攻撃する",
    lore: "繭を砕いた者は、中にいた何かを見てしまった。それが何だったか、誰も正しく思い出せない。",
  },
};
