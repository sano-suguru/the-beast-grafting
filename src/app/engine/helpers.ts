import { UNITS } from "../data/units";
import { CHURCH_UNITS } from "../data/church-units";
import type { UnitInstance, EnemyTeam, EquipInfo } from "../types";
import type { Rng } from "./rng";
import { createDefaultRng } from "./rng";
import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { invariant } from "../../shared/invariant";

export const generateUid = (): string => Math.random().toString(36).substring(2, 11);

export const createUnit = (id: string, isChurch = false): Result<UnitInstance, GameError> => {
  const db = CHURCH_UNITS[id] ? CHURCH_UNITS : UNITS;
  const data = db[id];
  if (!data) return err({ type: "NOT_FOUND", entity: `unit:${id}` });
  return ok({
    ...data,
    atk: data.baseAtk,
    hp: data.baseHp,
    level: 1,
    exp: 0,
    equip: null,
    uid: generateUid(),
    isChurch,
  });
};

export const getShopPool = (round: number): string[] => {
  const pool = ["rat", "beggar", "hound", "bat", "zealot"];
  if (round >= 3) pool.push("martyr", "beast", "cholera");
  if (round >= 5) pool.push("parasite", "maiden", "revenant");
  if (round >= 7) pool.push("evangelist", "altar", "machine");
  if (round >= 9) pool.push("shrieking_throat", "hundred_arms", "chalice");
  if (round >= 11) pool.push("brains", "eye", "beelzebub", "rot_ring");
  return pool;
};

export const getUnitsByTier = (tier: number): string[] =>
  Object.entries(UNITS)
    .filter(([, data]) => data.tier === tier)
    .map(([id]) => id);

export const getItemPool = (): string[] => [
  "preservative",
  "iron_plate",
  "bile",
  "maggot",
  "corpse_wax",
  "numbness",
  "acid_blood",
  "death_curse",
];

const pickRandom = (arr: string[], rng: Rng): string => {
  invariant(arr.length > 0, "pickRandom: empty array");
  return arr[Math.floor(rng.next() * arr.length)]!;
};

const generateTeamName = (isCult: boolean, type: string, rng: Rng): string => {
  const adjectivesCult = ["純白の", "灰の", "盲目なる", "断罪の"];
  const nounsCult = ["巡礼者部隊", "異端審問隊", "聖騎士団"];
  const adjectivesGrafter = ["貪欲なる", "狂気に飲まれた", "血塗られた", "名もなき"];
  const nounsGrafter = ["地下の接合術師", "解剖医", "死体泥棒"];

  const adj = isCult ? pickRandom(adjectivesCult, rng) : pickRandom(adjectivesGrafter, rng);
  const noun = isCult ? pickRandom(nounsCult, rng) : pickRandom(nounsGrafter, rng);
  return `[${type}] ${adj}${noun}`;
};

function mustCreateUnit(id: string, isChurch = false): UnitInstance {
  const result = createUnit(id, isChurch);
  invariant(result.isOk(), `mustCreateUnit failed: ${id}`);
  return result.value;
}

const generateCultTeam = (round: number): UnitInstance[] => {
  if (round === 1) return [mustCreateUnit("squire", true), mustCreateUnit("church_hound", true)];
  if (round <= 3)
    return [
      mustCreateUnit("priest", true),
      mustCreateUnit("inquisitor", true),
      mustCreateUnit("church_hound", true),
    ];
  if (round <= 6)
    return [
      mustCreateUnit("templar", true),
      mustCreateUnit("priest", true),
      mustCreateUnit("inquisitor", true),
      mustCreateUnit("church_beast", true),
      mustCreateUnit("church_hound", true),
    ];
  return [
    mustCreateUnit("templar", true),
    mustCreateUnit("templar", true),
    mustCreateUnit("priest", true),
    mustCreateUnit("church_beast", true),
    mustCreateUnit("church_beast", true),
  ];
};

const generateGrafterTeam = (round: number): UnitInstance[] => {
  if (round <= 2) return [mustCreateUnit("bat"), mustCreateUnit("rat"), mustCreateUnit("hound")];
  if (round <= 4)
    return [
      mustCreateUnit("martyr"),
      mustCreateUnit("beast"),
      mustCreateUnit("hound"),
      mustCreateUnit("bat"),
    ];
  if (round <= 7)
    return [
      mustCreateUnit("parasite"),
      mustCreateUnit("maiden"),
      mustCreateUnit("beast"),
      mustCreateUnit("hound"),
      mustCreateUnit("martyr"),
    ];
  if (round <= 10)
    return [
      mustCreateUnit("evangelist"),
      mustCreateUnit("altar"),
      mustCreateUnit("parasite"),
      mustCreateUnit("maiden"),
      mustCreateUnit("hound"),
    ];
  return [
    mustCreateUnit("shrieking_throat"),
    mustCreateUnit("hundred_arms"),
    mustCreateUnit("eye"),
    mustCreateUnit("parasite"),
    mustCreateUnit("maiden"),
  ];
};

export const generateEnemyTeam = (round: number, rng: Rng = createDefaultRng()): EnemyTeam => {
  const isCult = rng.next() > round * 0.1;
  const type = isCult ? "教団" : "同業者";
  const teamName = generateTeamName(isCult, type, rng);

  let units = isCult ? generateCultTeam(round) : generateGrafterTeam(round);

  // Make end-game enemies stronger randomly
  if (round >= 5) {
    units = units.map((u) => ({
      ...u,
      atk: u.atk + Math.floor(round / 2),
      hp: u.hp + Math.floor(round / 2),
      level: Math.min(3, Math.ceil(round / 4)),
    }));
  }

  return { teamName, teamType: type, units };
};

const EQUIP_INFO: Record<string, EquipInfo> = {
  iron: { name: "縫合された鉄板", desc: "【鉄の皮膚】被ダメージ-2(最低2)" },
  berserk: { name: "狂戦士の胆汁", desc: "【狂乱】攻撃時ダメージ+3" },
  corpse_wax: { name: "屍蝋の盾", desc: "【屍蝋】一度だけ20ダメージを防ぐ" },
  infection: { name: "感染", desc: "【感染】被ダメージ+3" },
  maggot_nest: { name: "腐肉喰いの蛆虫", desc: "【蛆虫の苗床】死亡時、1/1巨大蛆虫を召喚" },
  numbness: { name: "痛覚麻痺", desc: "【痛覚麻痺】被ダメージ-7(2回, 最低2)" },
  acid: { name: "酸の血液", desc: "【酸血】攻撃時、敵の後ろに5ダメージ" },
  death_curse: { name: "道連れの呪符", desc: "【道連れ】死亡時、1/1で蘇生" },
};

export const getEquipInfo = (equipId: string): Result<EquipInfo, GameError> => {
  const info = EQUIP_INFO[equipId];
  return info ? ok(info) : err({ type: "NOT_FOUND", entity: `equip:${equipId}` });
};
