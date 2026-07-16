/**
 * Parallel Think Engine - Core Orchestrator
 *
 * Runs multiple reasoning strategies in parallel, scores results,
 * synthesizes findings, and drives the endless improvement loop.
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────┐
 * │                    Improvement Loop                          │
 * │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
 * │  │ Strategy │  │ Strategy │  │ Strategy │  │ Strategy │   │
 * │  │    A     │  │    B     │  │    C     │  │    D     │   │
 * │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
 * │       │              │              │              │         │
 * │       └──────────────┼──────────────┼──────────────┘         │
 * │                      ▼                                       │
 * │              ┌──────────────┐                                │
 * │              │   Scorer     │                                │
 * │              └──────┬───────┘                                │
 * │                     ▼                                        │
 * │              ┌──────────────┐                                │
 * │              │ Synthesizer  │──► Feedback Loop ──►           │
 * │              └──────────────┘                    (next round)│
 * └──────────────────────────────────────────────────────────────┘
 */

import type {
  ThinkingProblem,
  StrategyName,
  StrategyResult,
  ScoredResult,
  SynthesizedResult,
  ImprovementRound,
  ImprovementHistory,
  RoundMetrics,
  EngineConfig,
  StrategyStats,
} from './types.js';
import { STRATEGIES, type StrategyContext } from './strategies.js';
import { scoreResult, rankResults, updateStrategyWeights } from './scorer.js';

const DEFAULT_CONFIG: EngineConfig = {
  strategies: [
    'first-principles',
    'inversion',
    'constraint-analysis',
    'adversarial',
    'analogical',
    'decomposition',
    'simulation',
  ],
  maxParallel: 7,
  scoringWeights: {},
  improvementTarget: 85,
  maxRounds: 10,
  feedbackDepth: 3,
};

export type ProgressCallback = (event: ProgressEvent) => void;

export interface ProgressEvent {
  type: 'round-start' | 'strategy-complete' | 'round-scored' | 'round-complete' | 'converged' | 'improvement-complete';
  round?: number;
  strategy?: StrategyName;
  result?: ScoredResult;
  metrics?: RoundMetrics;
  history?: ImprovementHistory;
}

/**
 * Main entry point: Run the parallel thinking engine on a problem.
 * Returns the full improvement history with all rounds.
 */
export async function think(
  problem: ThinkingProblem,
  config: Partial<EngineConfig> = {},
  onProgress?: ProgressCallback
): Promise<ImprovementHistory> {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...config };
  const maxRounds = problem.maxIterations || cfg.maxRounds;
  const targetConfidence = problem.targetConfidence || cfg.improvementTarget;

  const history: ImprovementHistory = {
    problemId: problem.id,
    rounds: [],
    totalTimeMs: 0,
    finalResult: null as unknown as SynthesizedResult,
    convergenceAchieved: false,
    strategyPerformance: initStrategyStats(cfg.strategies),
  };

  let strategyWeights = Object.fromEntries(
    cfg.strategies.map(s => [s, 1.0])
  ) as Record<StrategyName, number>;

  const totalStart = Date.now();

  for (let round = 1; round <= maxRounds; round++) {
    onProgress?.({ type: 'round-start', round });

    const roundResult = await executeRound(
      problem, round, cfg, strategyWeights, history, onProgress
    );

    history.rounds.push(roundResult);
    strategyWeights = roundResult.strategyWeights;

    // Update strategy performance stats
    updateStrategyPerformance(history.strategyPerformance, roundResult);

    onProgress?.({
      type: 'round-complete',
      round,
      metrics: roundResult.metrics,
    });

    // Check convergence
    if (roundResult.winner.totalScore >= targetConfidence) {
      history.convergenceAchieved = true;
      onProgress?.({ type: 'converged', round });
      break;
    }

    // Check if improvement has stalled (less than 1% improvement for 3 rounds)
    if (round >= 4) {
      const recentImprovement = history.rounds
        .slice(-3)
        .map(r => r.metrics.improvementOverPrevious);
      const avgImprovement = recentImprovement.reduce((a, b) => a + b, 0) / 3;
      if (avgImprovement < 0.5) {
        // Stalled - shake up strategy weights
        cfg.strategies.forEach(s => {
          strategyWeights[s] = 0.8 + Math.random() * 0.4; // randomize slightly
        });
      }
    }
  }

  history.totalTimeMs = Date.now() - totalStart;
  history.finalResult = history.rounds[history.rounds.length - 1].synthesized;

  onProgress?.({ type: 'improvement-complete', history });

  return history;
}

/**
 * Execute a single round: run all strategies in parallel, score, rank, synthesize.
 */
async function executeRound(
  problem: ThinkingProblem,
  roundNumber: number,
  config: EngineConfig,
  strategyWeights: Record<StrategyName, number>,
  history: ImprovementHistory,
  onProgress?: ProgressCallback
): Promise<ImprovementRound> {
  const roundStart = Date.now();

  // Build context from prior rounds
  const ctx = buildStrategyContext(roundNumber, history, config.feedbackDepth);

  // Execute all strategies in parallel
  const strategyPromises = config.strategies.map(async (strategyName) => {
    const strategyFn = STRATEGIES[strategyName];
    if (!strategyFn) throw new Error(`Unknown strategy: ${strategyName}`);

    const result = await strategyFn(problem, ctx);

    onProgress?.({ type: 'strategy-complete', round: roundNumber, strategy: strategyName });

    return result;
  });

  // Await all parallel results
  const results = await Promise.all(strategyPromises);

  // Score all results
  const scoredResults = results.map(r =>
    scoreResult(r, results, config, strategyWeights)
  );

  // Rank results
  const ranked = rankResults(scoredResults);

  onProgress?.({ type: 'round-scored', round: roundNumber, result: ranked[0] });

  // Synthesize findings from all strategies
  const synthesized = synthesizeResults(ranked, history);

  // Calculate round metrics
  const metrics = calculateRoundMetrics(ranked, history, roundStart);

  // Update strategy weights based on this round's performance
  const newWeights = updateStrategyWeights(strategyWeights, ranked);

  return {
    roundNumber,
    timestamp: Date.now(),
    problem,
    results: ranked,
    winner: ranked[0],
    synthesized,
    metrics,
    strategyWeights: newWeights,
  };
}

/**
 * Build context for strategies based on prior rounds.
 */
function buildStrategyContext(
  roundNumber: number,
  history: ImprovementHistory,
  feedbackDepth: number
): StrategyContext {
  if (roundNumber === 1 || history.rounds.length === 0) {
    return { roundNumber };
  }

  const recentRounds = history.rounds.slice(-feedbackDepth);
  const lastRound = recentRounds[recentRounds.length - 1];

  return {
    roundNumber,
    priorResults: lastRound.results,
    priorWinner: lastRound.winner,
    blindSpots: lastRound.synthesized.blindSpots,
  };
}

/**
 * Synthesize findings across all strategy results into a unified conclusion.
 */
function synthesizeResults(
  ranked: ScoredResult[],
  history: ImprovementHistory
): SynthesizedResult {
  // Find consensus: conclusions that multiple strategies agree on
  const allConclusions = ranked.map(r => r.conclusion);
  const consensusPoints: string[] = [];
  const dissensionPoints: string[] = [];

  // Group similar conclusions
  for (let i = 0; i < ranked.length; i++) {
    const hasAgreement = ranked.some((other, j) =>
      i !== j && wordOverlap(ranked[i].conclusion, other.conclusion) > 0.3
    );

    if (hasAgreement) {
      consensusPoints.push(`[${ranked[i].strategyName}] ${ranked[i].conclusion.substring(0, 120)}`);
    } else {
      dissensionPoints.push(`[${ranked[i].strategyName}] ${ranked[i].conclusion.substring(0, 120)}`);
    }
  }

  // Extract key insights (top unique findings)
  const keyInsights = ranked
    .slice(0, 3)
    .map(r => `${r.strategyName} (score: ${r.totalScore.toFixed(1)}): ${r.conclusion.substring(0, 100)}`);

  // Identify blind spots: areas no strategy covered well
  const blindSpots: string[] = [];
  const allAssumptions = ranked.flatMap(r => r.assumptions);
  const untestedAssumptions = allAssumptions.filter(a =>
    !ranked.some(r => r.reasoning.some(step =>
      step.evidence && step.evidence.toLowerCase().includes(a.toLowerCase().substring(0, 20))
    ))
  );
  if (untestedAssumptions.length > 0) {
    blindSpots.push(`Untested assumptions: ${untestedAssumptions.slice(0, 3).join('; ')}`);
  }

  const avgRisk = ranked.flatMap(r => r.risks);
  const uniqueRisks = [...new Set(avgRisk)];
  if (uniqueRisks.length > ranked.length) {
    blindSpots.push(`${uniqueRisks.length} unique risks identified across strategies`);
  }

  // Synthesized confidence: weighted average by score
  const totalWeight = ranked.reduce((sum, r) => sum + r.totalScore, 0);
  const weightedConfidence = totalWeight > 0
    ? ranked.reduce((sum, r) => sum + r.confidence * r.totalScore, 0) / totalWeight
    : 50;

  return {
    conclusion: `Synthesized from ${ranked.length} parallel strategies. Winner: ${ranked[0].strategyName} (score: ${ranked[0].totalScore.toFixed(1)}). ${consensusPoints.length} consensus points, ${dissensionPoints.length} divergent perspectives.`,
    confidence: Math.round(weightedConfidence),
    keyInsights,
    consensusPoints: [...new Set(consensusPoints)].slice(0, 5),
    dissensionPoints: [...new Set(dissensionPoints)].slice(0, 5),
    blindSpots,
    recommendation: ranked[0].conclusion,
  };
}

/**
 * Calculate metrics for a round of parallel thinking.
 */
function calculateRoundMetrics(
  ranked: ScoredResult[],
  history: ImprovementHistory,
  roundStart: number
): RoundMetrics {
  const confidences = ranked.map(r => r.confidence);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const maxConfidence = Math.max(...confidences);
  const minConfidence = Math.min(...confidences);

  // Improvement over previous round
  const prevWinnerScore = history.rounds.length > 0
    ? history.rounds[history.rounds.length - 1].winner.totalScore
    : 0;
  const improvementOverPrevious = ranked[0].totalScore - prevWinnerScore;

  // Convergence rate: how much are strategies aligning?
  const conclusions = ranked.map(r => r.conclusion);
  let totalSimilarity = 0;
  let pairs = 0;
  for (let i = 0; i < conclusions.length; i++) {
    for (let j = i + 1; j < conclusions.length; j++) {
      totalSimilarity += wordOverlap(conclusions[i], conclusions[j]);
      pairs++;
    }
  }
  const convergenceRate = pairs > 0 ? totalSimilarity / pairs : 0;

  // Diversity index (Shannon entropy of scores)
  const totalScore = ranked.reduce((sum, r) => sum + r.totalScore, 0);
  let diversityIndex = 0;
  if (totalScore > 0) {
    for (const r of ranked) {
      const p = r.totalScore / totalScore;
      if (p > 0) diversityIndex -= p * Math.log2(p);
    }
  }

  return {
    totalTimeMs: Date.now() - roundStart,
    avgConfidence,
    maxConfidence,
    confidenceSpread: maxConfidence - minConfidence,
    improvementOverPrevious,
    convergenceRate,
    diversityIndex,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) { if (wordsB.has(w)) overlap++; }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function initStrategyStats(strategies: StrategyName[]): Record<StrategyName, StrategyStats> {
  const stats: Record<string, StrategyStats> = {};
  for (const s of strategies) {
    stats[s] = {
      timesRun: 0,
      timesWon: 0,
      avgScore: 0,
      bestScore: 0,
      avgConfidence: 0,
      avgExecutionTimeMs: 0,
    };
  }
  return stats as Record<StrategyName, StrategyStats>;
}

function updateStrategyPerformance(
  stats: Record<StrategyName, StrategyStats>,
  round: ImprovementRound
): void {
  for (const result of round.results) {
    const s = stats[result.strategyName];
    if (!s) continue;

    s.timesRun++;
    if (result.rank === 1) s.timesWon++;
    s.avgScore = ((s.avgScore * (s.timesRun - 1)) + result.totalScore) / s.timesRun;
    s.bestScore = Math.max(s.bestScore, result.totalScore);
    s.avgConfidence = ((s.avgConfidence * (s.timesRun - 1)) + result.confidence) / s.timesRun;
    s.avgExecutionTimeMs = ((s.avgExecutionTimeMs * (s.timesRun - 1)) + result.executionTimeMs) / s.timesRun;
  }
}

export { DEFAULT_CONFIG };
