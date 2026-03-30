import type { OriginId, OriginData } from "../types";

export const ORIGINS: Record<OriginId, OriginData> = {
  thief: {
    id: "thief",
    name: "卑劣なる死体泥棒",
    desc: "毎夜、最初の「墓暴き」が無料。",
    lore: "教会の墓地を荒らし、生計を立てていた小悪党。狂気より実利を重んじ、闇市場の商人ともツーカーの仲だ。",
  },
  inquisitor: {
    id: "inquisitor",
    name: "堕ちた異端審問官",
    desc: "毎夜、闇市場の素体1体がより上位の素体に変異する。",
    lore: "かつて教会の猟犬として魔女を狩っていたが、禁忌の魅力に取り憑かれ追われる身となった。",
  },
  surgeon: {
    id: "surgeon",
    name: "狂気の解剖医",
    desc: "解体(売却)時、味方1体に+1/+1。",
    lore: "純粋な医学的探求から、生命の倫理を踏み越えた学者。肉体を切り刻む行為そのものに悦びを見出している。",
  },
  cultist: {
    id: "cultist",
    name: "深淵の邪教徒",
    desc: "毎夜、正気度を1失い鮮血を3得る。",
    lore: "地下の祭壇で邪神に血を捧げる狂信者。目的のためならば、自らの魂や肉体を削ることも厭わない。",
  },
};
