import type { BattleFrame, BattleUnitSnapshot } from "../../../shared/types";

export interface UnitBattleStat {
  uid: string;
  name: string;
  damageDealt: number;
  alive: boolean;
  finalHp: number;
  maxHp: number;
}

interface BattleStats {
  playerUnits: UnitBattleStat[];
  enemyUnits: UnitBattleStat[];
}

const DAMAGE_RE = /^-(\d+)$/;

function parseDamageValue(value: string | undefined): number {
  if (!value) return 0;
  const m = DAMAGE_RE.exec(value);
  return m ? Number(m[1]) : 0;
}

export function computeBattleStats(frames: BattleFrame[]): BattleStats {
  if (frames.length === 0) return { playerUnits: [], enemyUnits: [] };

  const first = frames[0]!;
  const last = frames[frames.length - 1]!;

  const damageMap = new Map<string, number>();

  for (const frame of frames) {
    for (const [, action] of Object.entries(frame.actions)) {
      if (action.type === "damage" && action.source) {
        damageMap.set(
          action.source,
          (damageMap.get(action.source) ?? 0) + parseDamageValue(action.value),
        );
      }
    }
  }

  function toStats(initial: BattleUnitSnapshot[], final: BattleUnitSnapshot[]): UnitBattleStat[] {
    const finalMap = new Map(final.map((u) => [u.uid, u]));
    return initial.map((u) => {
      const f = finalMap.get(u.uid);
      return {
        uid: u.uid,
        name: u.name,
        damageDealt: damageMap.get(u.uid) ?? 0,
        alive: f ? f.hp > 0 : false,
        finalHp: f ? Math.max(f.hp, 0) : 0,
        maxHp: u.hp,
      };
    });
  }

  return {
    playerUnits: toStats(first.pBoard, last.pBoard),
    enemyUnits: toStats(first.eBoard, last.eBoard),
  };
}
