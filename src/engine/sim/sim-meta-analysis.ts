import type {
  DominantTeam,
  MatchupEntry,
  MetaAnalysis,
  MetaHealthVerdict,
  PayoffCell,
} from "./sim-report-types";

const STRONG_DOMINANCE = 0.6;
const DEGENERATE_DOMINANCE = 0.7;
const FP_MAX_ITERS = 1000;
const FP_EPSILON = 0.001;

// ── Payoff Matrix ──

function buildPayoffMatrix(matchups: readonly MatchupEntry[]): {
  labels: string[];
  matrix: PayoffCell[][];
} {
  const teamSet = new Set<string>();
  for (const m of matchups) {
    teamSet.add(m.teamA);
    teamSet.add(m.teamB);
  }
  const labels = [...teamSet].sort();
  const idx = new Map(labels.map((l, i) => [l, i]));
  const n = labels.length;

  const matrix: PayoffCell[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ winRate: 0.5, wins: 0, losses: 0, draws: 0 })),
  );

  for (const m of matchups) {
    const i = idx.get(m.teamA)!;
    const j = idx.get(m.teamB)!;
    const total = m.aWins + m.bWins + m.draws;
    if (total === 0) continue;
    const aWR = (m.aWins + m.draws * 0.5) / total;
    const bWR = (m.bWins + m.draws * 0.5) / total;
    matrix[i]![j] = { winRate: aWR, wins: m.aWins, losses: m.bWins, draws: m.draws };
    matrix[j]![i] = { winRate: bWR, wins: m.bWins, losses: m.aWins, draws: m.draws };
  }
  return { labels, matrix };
}

// ── Dominance Detection ──

function detectDominance(
  labels: readonly string[],
  matrix: readonly PayoffCell[][],
): DominantTeam[] {
  const n = labels.length;
  const result: DominantTeam[] = [];
  for (let i = 0; i < n; i++) {
    let minWR = 1;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      minWR = Math.min(minWR, matrix[i]![j]!.winRate);
    }
    if (minWR > STRONG_DOMINANCE) {
      result.push({ team: labels[i]!, type: "strong", minWinRate: minWR });
    } else if (minWR > 0.5) {
      result.push({ team: labels[i]!, type: "weak", minWinRate: minWR });
    }
  }
  return result;
}

// ── Nash Equilibrium (Fictitious Play) ──

interface NashResult {
  readonly probabilities: number[];
  readonly converged: boolean;
}

function fictitiousPlay(matrix: readonly PayoffCell[][]): NashResult {
  const n = matrix.length;
  if (n === 0) return { probabilities: [], converged: true };

  const counts = new Float64Array(n).fill(1);
  let converged = false;

  for (let iter = 0; iter < FP_MAX_ITERS; iter++) {
    const total = counts.reduce((a, b) => a + b, 0);
    const prev = new Float64Array(n);
    for (let i = 0; i < n; i++) prev[i] = counts[i]! / total;

    // Best response: find row i maximizing expected payoff against opponent mix
    let bestRow = 0;
    let bestPayoff = -Infinity;
    for (let i = 0; i < n; i++) {
      let payoff = 0;
      for (let j = 0; j < n; j++) payoff += matrix[i]![j]!.winRate * prev[j]!;
      if (payoff > bestPayoff) {
        bestPayoff = payoff;
        bestRow = i;
      }
    }
    counts[bestRow]! += 1;

    const newTotal = total + 1;
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(counts[i]! / newTotal - prev[i]!));
    }
    if (maxDelta < FP_EPSILON) {
      converged = true;
      break;
    }
  }

  const total = counts.reduce((a, b) => a + b, 0);
  const probabilities = Array.from(counts, (c) => c / total);
  return { probabilities, converged };
}

function entropy(probs: readonly number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

// ── Cyclicity Score ──

function* triplets(n: number): Generator<[number, number, number]> {
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) yield [a, b, c];
}

function computeCyclicity(matrix: readonly PayoffCell[][]): number {
  const n = matrix.length;
  if (n < 3) return 0;

  let cyclic = 0;
  let total = 0;
  for (const [a, b, c] of triplets(n)) {
    total++;
    const ab = matrix[a]![b]!.winRate > 0.5 ? 1 : -1;
    const bc = matrix[b]![c]!.winRate > 0.5 ? 1 : -1;
    const ca = matrix[c]![a]!.winRate > 0.5 ? 1 : -1;
    if (ab + bc + ca !== 3 && ab + bc + ca !== -3) cyclic++;
  }
  return total === 0 ? 0 : cyclic / total;
}

// ── Health Verdict ──

function judgeHealth(
  dominants: readonly DominantTeam[],
  eqEntropy: number,
  maxEnt: number,
  cyclicity: number,
  matrix: readonly PayoffCell[][],
): { verdict: MetaHealthVerdict; reasons: string[] } {
  const reasons: string[] = [];
  const n = matrix.length;

  const strongDoms = dominants.filter((d) => d.type === "strong");
  const degenerateDoms = dominants.filter((d) => d.minWinRate > DEGENERATE_DOMINANCE);

  if (degenerateDoms.length > 0) {
    reasons.push(
      ...degenerateDoms.map(
        (d) => `${d.team} が全対戦で勝率 ${(d.minWinRate * 100).toFixed(1)}% 以上（1強支配）`,
      ),
    );
    return { verdict: "degenerate", reasons };
  }

  if (strongDoms.length > 0) {
    reasons.push(
      ...strongDoms.map((d) => `${d.team} が全対戦で勝率 ${(d.minWinRate * 100).toFixed(1)}% 以上`),
    );
    return { verdict: "dominant_meta", reasons };
  }

  const entropyRatio = maxEnt > 0 ? eqEntropy / maxEnt : 0;
  const weakDoms = dominants.filter((d) => d.type === "weak");

  if (weakDoms.length > 0 || entropyRatio < 0.6) {
    if (weakDoms.length > 0) {
      reasons.push(...weakDoms.map((d) => `${d.team} が全対戦で勝ち越し（弱支配）`));
    }
    if (entropyRatio < 0.6) {
      reasons.push(`均衡エントロピー比 ${(entropyRatio * 100).toFixed(0)}%（メタが偏っている）`);
    }
    return { verdict: "slightly_skewed", reasons };
  }

  reasons.push(`支配戦略なし、均衡エントロピー比 ${(entropyRatio * 100).toFixed(0)}%`);
  if (cyclicity > 0.3 && n >= 3) {
    reasons.push(`循環度 ${(cyclicity * 100).toFixed(0)}%（じゃんけん関係あり）`);
  }
  return { verdict: "healthy", reasons };
}

// ── Public API ──

export function analyzeMetaHealth(matchups: readonly MatchupEntry[]): MetaAnalysis {
  const { labels, matrix } = buildPayoffMatrix(matchups);
  const dominants = detectDominance(labels, matrix);
  const nash = fictitiousPlay(matrix);
  const eqEntropy = entropy(nash.probabilities);
  const maxEnt = labels.length > 0 ? Math.log2(labels.length) : 0;
  const cyclicity = computeCyclicity(matrix);
  const { verdict, reasons } = judgeHealth(dominants, eqEntropy, maxEnt, cyclicity, matrix);

  return {
    teamLabels: labels,
    payoffMatrix: matrix,
    dominantTeams: dominants,
    nashEquilibrium: labels.map((team, i) => ({ team, probability: nash.probabilities[i]! })),
    nashConverged: nash.converged,
    equilibriumEntropy: eqEntropy,
    maxEntropy: maxEnt,
    cyclicityScore: cyclicity,
    healthVerdict: verdict,
    verdictReasons: reasons,
  };
}
