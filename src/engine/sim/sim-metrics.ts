import type { BattleFrame, BattleResult, BattleUnitSnapshot, UnitId } from "../../shared/types";
import type { Buff } from "../../shared/skill-params";
import type { BattleMetrics, UnitActionTally } from "./sim-types";

interface MutableTally {
  unitId: UnitId;
  side: "player" | "enemy";
  damageDealt: number;
  damageReceived: number;
  buffAtk: number;
  buffHp: number;
  buffAtkGiven: number;
  buffHpGiven: number;
  healingDone: number;
  healingReceived: number;
  skillCount: number;
  kills: number;
  spawnsProduced: number;
  deathFrame: number | null;
}

const EMPTY_METRICS: BattleMetrics = {
  frameCount: 0,
  result: null,
  pSurvivorCount: 0,
  eSurvivorCount: 0,
  winnerRemainingHp: 0,
  unitActions: new Map(),
};

/** 1戦闘のフレームデータからバトルメトリクスを抽出 */
export function extractBattleMetrics(
  frames: readonly BattleFrame[],
  result: BattleResult,
): BattleMetrics {
  if (frames.length === 0) return { ...EMPTY_METRICS, result };

  const first = frames[0]!;
  const last = frames[frames.length - 1]!;

  const tallyMap = buildTallyMap(first);
  scanFrameActions(frames, tallyMap);

  const pSurvivors = new Set(last.pBoard.map((u) => u.uid));
  const eSurvivors = new Set(last.eBoard.map((u) => u.uid));
  const unitActions = freezeTallies(tallyMap, pSurvivors, eSurvivors);

  return {
    frameCount: frames.length,
    result,
    pSurvivorCount: pSurvivors.size,
    eSurvivorCount: eSurvivors.size,
    winnerRemainingHp: computeWinnerHp(result, last),
    unitActions,
  };
}

function emptyTally(id: UnitId, side: "player" | "enemy"): MutableTally {
  return {
    unitId: id,
    side,
    damageDealt: 0,
    damageReceived: 0,
    buffAtk: 0,
    buffHp: 0,
    buffAtkGiven: 0,
    buffHpGiven: 0,
    healingDone: 0,
    healingReceived: 0,
    skillCount: 0,
    kills: 0,
    spawnsProduced: 0,
    deathFrame: null,
  };
}

function buildTallyMap(first: BattleFrame): Map<string, MutableTally> {
  const map = new Map<string, MutableTally>();
  for (const u of first.pBoard) map.set(u.uid, emptyTally(u.id, "player"));
  for (const u of first.eBoard) map.set(u.uid, emptyTally(u.id, "enemy"));
  return map;
}

function scanFrameActions(
  frames: readonly BattleFrame[],
  tallyMap: Map<string, MutableTally>,
): void {
  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi]!;
    for (const [uid, action] of Object.entries(frame.actions)) {
      processAction(tallyMap, uid, action, frame, fi);
    }
  }
}

type ActionFields = {
  type: string;
  source?: string;
  damage?: number;
  buff?: Buff;
  heal?: number;
  killer?: string;
  spawnedBy?: string;
};

function processAction(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  action: ActionFields,
  frame: BattleFrame,
  fi: number,
): void {
  // フィールドベース抽出（type に依存しない）
  if (action.damage != null) {
    recordDamage(tallyMap, uid, action.source, action.damage);
  }
  if (action.buff) {
    recordBuff(tallyMap, uid, action.source, action.buff);
  }
  if (action.heal != null) {
    recordHeal(tallyMap, uid, action.source, action.heal);
  }

  // type ベース抽出（type が唯一の情報源であるもの）
  processActionType(tallyMap, uid, action, frame, fi);
}

function processActionType(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  action: ActionFields,
  frame: BattleFrame,
  fi: number,
): void {
  switch (action.type) {
    case "skill": {
      const t = tallyMap.get(uid);
      if (t) t.skillCount++;
      break;
    }
    case "death":
      recordDeath(tallyMap, uid, action.killer, fi);
      break;
    case "summon":
      registerSummon(tallyMap, uid, frame);
      recordSpawn(tallyMap, action.spawnedBy);
      break;
  }
}

function recordDeath(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  killer: string | undefined,
  fi: number,
): void {
  const t = tallyMap.get(uid);
  if (t && t.deathFrame === null) t.deathFrame = fi;
  if (killer) {
    const k = tallyMap.get(killer);
    if (k) k.kills++;
  }
}

function recordSpawn(tallyMap: Map<string, MutableTally>, spawnedBy: string | undefined): void {
  if (!spawnedBy) return;
  const s = tallyMap.get(spawnedBy);
  if (s) s.spawnsProduced++;
}

function recordDamage(
  tallyMap: Map<string, MutableTally>,
  targetUid: string,
  source: string | undefined,
  damage: number | undefined,
): void {
  if (damage == null || damage <= 0) return;
  if (source) {
    const src = tallyMap.get(source);
    if (src) src.damageDealt += damage;
  }
  const tgt = tallyMap.get(targetUid);
  if (tgt) tgt.damageReceived += damage;
}

function recordBuff(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  source: string | undefined,
  buff: Buff | undefined,
): void {
  if (!buff) return;
  const t = tallyMap.get(uid);
  if (t) {
    t.buffAtk += buff.atk;
    t.buffHp += buff.hp;
  }
  if (source && source !== uid) {
    const s = tallyMap.get(source);
    if (s) {
      s.buffAtkGiven += buff.atk;
      s.buffHpGiven += buff.hp;
    }
  }
}

function recordHeal(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  source: string | undefined,
  heal: number,
): void {
  if (heal <= 0) return;
  const t = tallyMap.get(uid);
  if (t) t.healingReceived += heal;
  if (source) {
    const s = tallyMap.get(source);
    if (s) s.healingDone += heal;
  }
}

function registerSummon(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  frame: BattleFrame,
): void {
  if (tallyMap.has(uid)) return;
  const snap = findSnapshot(frame, uid);
  if (!snap) return;
  const side = frame.pBoard.some((u) => u.uid === uid) ? "player" : "enemy";
  tallyMap.set(uid, emptyTally(snap.id, side));
}

function findSnapshot(frame: BattleFrame, uid: string): BattleUnitSnapshot | undefined {
  return frame.pBoard.find((u) => u.uid === uid) ?? frame.eBoard.find((u) => u.uid === uid);
}

function freezeTallies(
  tallyMap: ReadonlyMap<string, MutableTally>,
  pSurvivors: ReadonlySet<string>,
  eSurvivors: ReadonlySet<string>,
): ReadonlyMap<string, UnitActionTally> {
  const result = new Map<string, UnitActionTally>();
  for (const [uid, t] of tallyMap) {
    result.set(uid, {
      unitId: t.unitId,
      side: t.side,
      damageDealt: t.damageDealt,
      damageReceived: t.damageReceived,
      buffAtk: t.buffAtk,
      buffHp: t.buffHp,
      skillCount: t.skillCount,
      kills: t.kills,
      spawnsProduced: t.spawnsProduced,
      buffAtkGiven: t.buffAtkGiven,
      buffHpGiven: t.buffHpGiven,
      healingDone: t.healingDone,
      healingReceived: t.healingReceived,
      survived: pSurvivors.has(uid) || eSurvivors.has(uid),
      deathFrame: t.deathFrame,
    });
  }
  return result;
}

function computeWinnerHp(result: BattleResult, last: BattleFrame): number {
  const sumHp = (board: readonly BattleUnitSnapshot[]) =>
    board.reduce((sum, u) => sum + Math.max(u.hp, 0), 0);
  if (result === "WIN") return sumHp(last.pBoard);
  if (result === "LOSE") return sumHp(last.eBoard);
  return 0;
}
