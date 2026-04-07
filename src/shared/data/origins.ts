import type { OriginId, OriginData } from "../types";

export const ORIGINS: Record<OriginId, OriginData> = {
  thief: {
    id: "thief",
    name: "卑劣なる死体泥棒",
    desc: "毎夜、最初の「墓暴き」が無料。",
    lore: "爪の間にこびりついた墓土は、もう何度洗っても落ちない。",
    icon: "Shovel",
  },
  inquisitor: {
    id: "inquisitor",
    name: "堕ちた異端審問官",
    desc: "毎夜、闇市場の素体1体がより上位の素体に変異する。",
    lore: "聖印はまだ首にかかっている。祈りの言葉だけが、とうに失われた。",
    icon: "Flame",
  },
  surgeon: {
    id: "surgeon",
    name: "狂気の解剖医",
    desc: "解体(売却)時、味方1体に+1/+1。",
    lore: "手術台の染みを数えるのが、いつからか楽しみになっていた。",
    icon: "Scissors",
  },
  cultist: {
    id: "cultist",
    name: "深淵の邪教徒",
    desc: "毎夜、{life}を1失い{blood}を3得る。",
    lore: "両腕の切り傷は百を超えた頃から、数えるのをやめた。",
    icon: "Eye",
  },
};
