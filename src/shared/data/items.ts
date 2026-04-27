import type { ItemData, ItemEffect, ItemId } from "../types";
import { EQUIPS } from "./equips";

/** 錬金薬（消耗品）かどうか。equip=null のアイテムは装備付与ではなく一時的な強化薬。 */
export function isAlchemy(item: ItemData): boolean {
  return item.effect.kind !== "single_target_equip";
}

export function itemNeedsBoardTarget(item: ItemData): boolean {
  return item.effect.kind === "single_target_stat" || item.effect.kind === "single_target_equip";
}

export function itemHasMultipliableStats(item: ItemData): boolean {
  return item.effect.kind !== "single_target_equip";
}

function singleTargetStat(atk: number, hp: number): ItemEffect {
  return { kind: "single_target_stat", atk, hp };
}

function singleTargetEquipEffect(equip: keyof typeof EQUIPS): ItemEffect {
  return { kind: "single_target_equip", atk: 0, hp: 0, equip };
}

function randomTeamStat(atk: number, hp: number, count: number): ItemEffect {
  return { kind: "random_team_stat", atk, hp, count };
}

function shopCurrentAndFutureStat(atk: number, hp: number): ItemEffect {
  return { kind: "shop_current_and_future_stat", atk, hp };
}

export const ITEMS: Record<ItemId, ItemData> = {
  preservative: {
    id: "preservative",
    name: "濁った防腐液",
    cost: 3,
    atk: 1,
    hp: 1,
    equip: null,
    effect: singleTargetStat(1, 1),
    skillText: "対象に+1/+1",
    lore: "腐敗の進行を遅らせ、わずかに筋繊維を硬化させる安価な薬品。気休め程度にはなる。",
  },
  grave_pear: {
    id: "grave_pear",
    name: "墓熟れの果実",
    cost: 3,
    atk: 2,
    hp: 2,
    equip: null,
    effect: singleTargetStat(2, 2),
    skillText: "対象に+2/+2",
    lore: "地下墓地の湿気を吸って熟した黒い果肉。ひと齧りで死肉が膨らみ、筋と脂が均等に乗る。",
  },
  sushi: {
    id: "sushi",
    name: "供物の寿司",
    cost: 3,
    atk: 1,
    hp: 1,
    equip: null,
    effect: randomTeamStat(1, 1, 3),
    skillText: "ランダムな味方3体に+1/+1",
    lore: "死者の宴に供えられた生臭い握り。盤上を巡り、三つの肉片に等しく脂を残す。",
  },
  pizza: {
    id: "pizza",
    name: "墓焼きのピザ",
    cost: 3,
    atk: 2,
    hp: 2,
    equip: null,
    effect: randomTeamStat(2, 2, 2),
    skillText: "ランダムな味方2体に+2/+2",
    lore: "納骨堂の炉で焼いた黒い生地。ちぎった端から熱が走り、二つの肉塊を膨らませる。",
  },
  canned_food: {
    id: "canned_food",
    name: "肉詰めの缶詰",
    cost: 3,
    atk: 1,
    hp: 1,
    equip: null,
    effect: shopCurrentAndFutureStat(1, 1),
    skillText: "闇市場の現在と今後の全素体に+1/+1",
    lore: "濃い塩と脂で煮詰めた保存肉。蓋を開けた夜から、市場に並ぶ死体すべてがわずかに肉付きよく見える。",
  },
  iron_plate: {
    id: "iron_plate",
    name: EQUIPS.iron_plate.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "iron_plate",
    effect: singleTargetEquipEffect("iron_plate"),
    skillText: EQUIPS.iron_plate.desc,
    lore: "処刑された騎士の鎧の破片。素体の皮膚に直接太いワイヤーで縫い付けることで、致命傷を防ぐ。",
  },
  bile: {
    id: "bile",
    name: EQUIPS.bile.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "bile",
    effect: singleTargetEquipEffect("bile"),
    skillText: EQUIPS.bile.desc,
    lore: "異端審問で拷問死した男の胆嚢から抽出した黒い液体。注射された素体は、痛覚を失い狂乱状態に陥る。",
  },
  maggot: {
    id: "maggot",
    name: EQUIPS.maggot.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "maggot",
    effect: singleTargetEquipEffect("maggot"),
    skillText: EQUIPS.maggot.desc,
    lore: "腐った肉に群がる白い蛆虫の塊。素体の傷口に押し込めば、宿主の死後も蠢き続け、新たな肉体として這い出してくる。",
  },
  numbness: {
    id: "numbness",
    name: EQUIPS.numbness.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "numbness",
    effect: singleTargetEquipEffect("numbness"),
    skillText: EQUIPS.numbness.desc,
    lore: "脊髄に直接注入する乳白色の毒液。痛みを感じなくなった素体は、致命傷を負っても平然と動き続ける。",
  },
  acid_blood: {
    id: "acid_blood",
    name: EQUIPS.acid_blood.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "acid_blood",
    effect: singleTargetEquipEffect("acid_blood"),
    skillText: EQUIPS.acid_blood.desc,
    lore: "深淵の蟲から採取した腐食性の体液。素体の血管に流し込めば、斬りつけた傷口から飛沫が迸り、周囲の肉をも溶かす。",
  },
  corpse_wax: {
    id: "corpse_wax",
    name: EQUIPS.corpse_wax.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "corpse_wax",
    effect: singleTargetEquipEffect("corpse_wax"),
    skillText: EQUIPS.corpse_wax.desc,
    lore: "屍蝋で固められた人皮の盾。死者の脂肪が奇跡的な硬度を持ち、致命の一撃を一度だけ防ぐ。",
  },
  death_curse: {
    id: "death_curse",
    name: EQUIPS.death_curse.name,
    cost: 3,
    atk: 0,
    hp: 0,
    equip: "death_curse",
    effect: singleTargetEquipEffect("death_curse"),
    skillText: EQUIPS.death_curse.desc,
    lore: "死刑囚の皮膚に刻まれていた呪いの紋様。これを縫い付けた素体は、死してなお怨念で肉体を繋ぎ止め、一度だけ立ち上がる。",
  },
  pure_blood: {
    id: "pure_blood",
    name: "純血",
    cost: 0,
    atk: 1,
    hp: 2,
    equip: null,
    effect: singleTargetStat(1, 2),
    skillText: "対象に+1/+2",
    lore: "聖杯から生成された純粋な生命力。一滴垂らすだけで、朽ちかけた肉が脈打ち始める。対価は、何も要らない。",
  },
  pure_blood_2: {
    id: "pure_blood_2",
    name: "純血・上",
    cost: 0,
    atk: 2,
    hp: 4,
    equip: null,
    effect: singleTargetStat(2, 4),
    skillText: "対象に+2/+4",
    lore: "さらに精製された純血。触れた肉が獣のように脈動する。",
  },
  pure_blood_3: {
    id: "pure_blood_3",
    name: "純血・極",
    cost: 0,
    atk: 3,
    hp: 6,
    equip: null,
    effect: singleTargetStat(3, 6),
    skillText: "対象に+3/+6",
    lore: "聖杯の奇跡が凝縮された一滴。飲み干した者は、神に近いものへと変容する。",
  },
  bone_meal: {
    id: "bone_meal",
    name: "骨粉",
    cost: 0,
    atk: 1,
    hp: 0,
    equip: null,
    effect: singleTargetStat(1, 0),
    skillText: "対象に+1/+0",
    lore: "死肉啄みが溜め込んだ骨の粉。素体に振りかけると、筋繊維が硬化し攻撃力が僅かに上がる。",
  },
  worm_apple: {
    id: "worm_apple",
    name: "蟲の果実",
    cost: 2,
    atk: 1,
    hp: 1,
    equip: null,
    effect: singleTargetStat(1, 1),
    skillText: "対象に+1/+1",
    lore: "接ぎ穂の残骸が分泌した粘液の塊。素体に塗り込むと、肉が僅かに活性化する。",
  },
  worm_apple_2: {
    id: "worm_apple_2",
    name: "蟲の果実・上",
    cost: 2,
    atk: 2,
    hp: 2,
    equip: null,
    effect: singleTargetStat(2, 2),
    skillText: "対象に+2/+2",
    lore: "接ぎ穂が成熟し、より濃縮された粘液。触れた肉が脈打ち始める。",
  },
  worm_apple_3: {
    id: "worm_apple_3",
    name: "蟲の果実・極",
    cost: 2,
    atk: 3,
    hp: 3,
    equip: null,
    effect: singleTargetStat(3, 3),
    skillText: "対象に+3/+3",
    lore: "完全に熟した接ぎ穂の精髄。一滴で朽ちた肉が獣のように蠢き出す。",
  },
};
