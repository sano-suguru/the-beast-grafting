import type { UnitId } from "../../shared/types";
import type { Buff } from "../../shared/skill-params";
import type { BattleMetrics, SimBattleResult, UnitActionTally } from "./sim-types";

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

type ActionFields = {
  type: string;
  source?: string;
  damage?: number;
  buff?: Buff;
  heal?: number;
  killer?: string;
  spawnedBy?: string;
};

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

/** Extract metrics from lightweight sim data (no frame board clones). */
export function extractBattleMetricsSim(sim: SimBattleResult): BattleMetrics {
  if (sim.frameCount === 0) return { ...EMPTY_METRICS, result: sim.result };

  const tallyMap = new Map<string, MutableTally>();
  for (const [uid, entry] of sim.unitRegistry) {
    tallyMap.set(uid, emptyTally(entry.id, entry.side));
  }

  for (let fi = 0; fi < sim.simFrameActions.length; fi++) {
    const actions = sim.simFrameActions[fi]!;
    for (const uid of Object.keys(actions)) {
      processSimAction(tallyMap, uid, actions[uid]!, sim.unitRegistry, fi);
    }
  }

  const unitActions = freezeTallies(tallyMap, sim.pSurvivorUids, sim.eSurvivorUids);

  return {
    frameCount: sim.frameCount,
    result: sim.result,
    pSurvivorCount: sim.pSurvivorUids.size,
    eSurvivorCount: sim.eSurvivorUids.size,
    winnerRemainingHp: sim.winnerRemainingHp,
    unitActions,
  };
}

function processSimAction(
  tallyMap: Map<string, MutableTally>,
  uid: string,
  action: ActionFields,
  registry: SimBattleResult["unitRegistry"],
  fi: number,
): void {
  if (action.damage != null) recordDamage(tallyMap, uid, action.source, action.damage);
  if (action.buff) recordBuff(tallyMap, uid, action.source, action.buff);
  if (action.heal != null) recordHeal(tallyMap, uid, action.source, action.heal);

  switch (action.type) {
    case "skill": {
      const t = tallyMap.get(uid);
      if (t) t.skillCount++;
      break;
    }
    case "death":
      recordDeath(tallyMap, uid, action.killer, fi);
      break;
    case "summon": {
      if (!tallyMap.has(uid)) {
        const entry = registry.get(uid);
        if (entry) tallyMap.set(uid, emptyTally(entry.id, entry.side));
      }
      recordSpawn(tallyMap, action.spawnedBy);
      break;
    }
  }
}
