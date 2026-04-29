import type { MatchupEntry, SimReportData } from "./sim-report-types";

function roundNum(x: number): number {
  return Number.isInteger(x) ? x : Math.round(x * 1e4) / 1e4;
}

function roundValues(val: unknown): unknown {
  if (typeof val === "number") return roundNum(val);
  if (Array.isArray(val)) return val.map(roundValues);
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = roundValues(v);
    }
    return out;
  }
  return val;
}

/** archetypeMatchups の unitPerformance (574KB) を unitIds のみに圧縮 */
function slimMatchup(m: MatchupEntry): unknown {
  const { unitPerformance, ...rest } = m;
  return { ...rest, unitIds: Object.keys(unitPerformance) };
}

export function serializeReport(data: SimReportData): string {
  const slim = {
    ...data,
    archetypeMatchups: data.archetypeMatchups.map(slimMatchup),
  };
  return JSON.stringify(roundValues(slim));
}
