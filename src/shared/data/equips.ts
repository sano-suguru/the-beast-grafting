import type { EquipType, EquipInfo } from "../types";

export const EQUIPS: Record<EquipType, EquipInfo> = {
  iron: { name: "縫合された鉄板", desc: "【鉄の皮膚】被ダメージ-2(最低2)" },
  berserk: { name: "狂戦士の胆汁", desc: "【狂乱】攻撃時ダメージ+3" },
  corpse_wax: { name: "屍蝋の盾", desc: "【屍蝋】一度だけダメージを20軽減" },
  infection: {
    name: "感染",
    desc: "【感染】被ダメージ+Lv(Lv1:+1,Lv2:+2,Lv3:+3)、既存の装備を蝕む",
  },
  maggot_nest: { name: "腐肉喰いの蛆虫", desc: "【蛆虫の苗床】死亡時、1/1巨大蛆虫を召喚" },
  numbness: { name: "痛覚麻痺", desc: "【痛覚麻痺】被ダメージ-7(2回, 最低2)" },
  acid: { name: "酸の血液", desc: "【酸血】攻撃時、攻撃対象の後ろの1体に5ダメージ" },
  death_curse: { name: "道連れの呪符", desc: "【道連れ】死亡時、1/1のコピーとして蘇生" },
  star_frenzy: {
    name: "星辰の錯乱",
    desc: "【星辰の錯乱】死亡時、倒した敵が正気を失いランダムな味方を攻撃する",
  },
};

export const getEquipInfo = (equipId: EquipType): EquipInfo => EQUIPS[equipId];
