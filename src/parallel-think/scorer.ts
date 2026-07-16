/**
 * Parallel Think Engine - Result Scorer
 *
 * Scores strategy results on multiple dimensions and produces rankings.
 * The scoring system evolves: strategy weights adapt based on historical performance.
 */

import type {
  StrategyResult,
  ScoredResult,
  ScoreBreakdown,
  EngineConfig,
  StrategyName,
} from './types.js';

const DEFAULT_WEIGHTS: ScoreBreakdown = {
  depth: 25,
  breadth: 20,
  novelty: 20,
  rigor: 20,
  actionability: 15,
};

/**
 * Score a single strategy result across all quality dimensions.
 */
export function scoreResult(
  result: StrategyResult,
  allResults: StrategyResult[],
  config: EngineConfig,
  strategyWeights: Record<StrategyName, number>
): ScoredResult {
  const weights = { ...DEFAULT_WEIGHTS, ...config.scoringWeights };

  const scores: ScoreBreakdown = {
    depth: scoreDepth(result, weights.depth),
    breadth: scoreBreadth(result, weights.breadth),
    novelty: scoreNovelty(result, allResults, weights.novelty),
    rigor: scoreRigor(result, weights.rigor),
    actionability: scoreActionability(result, weights.actionability),
  };

  // Apply adaptive strategy weight multiplier
  const strategyMultiplier = strategyWeights[result.strategyName] || 1.0;
  const rawTotal = scores.depth + scores.breadth + scores.novelty + scores.rigor + scores.actionability;
  const totalScore = rawTotal * strategyMultiplier;

  return {
    ...result,
    scores,
    totalScore,
    rank: 0, // Will be set after ranking all results
  };
}

/**
 * Rank an array of scored results. Mutates rank field in place.
 */
export function rankResults(results: ScoredResult[]): ScoredResult[] {
  const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);
  sorted.forEach((r, i) => { r.rank = i + 1; });
  return sorted;
}

// ─── Scoring Dimensions ────────────────────────────────────────────────

/**
 * Depth: How deep is the reasoning chain?
 * Rewards longer, well-structured chains up to a point (diminishing returns after 10 steps).
 */
function scoreDepth(result: StrategyResult, maxScore: number): number {
  const stepCount = result.reasoning.length;
  const confirmedSteps = result.reasoning.filter(s => s.verdict === 'confirmed').length;

  // Logarithmic scaling: rewards depth but with diminishing returns
  const depthFactor = Math.log2(stepCount + 1) / Math.log2(12); // normalize around 11 steps
  const confirmRate = stepCount > 0 ? confirmedSteps / stepCount : 0;

  // Depth score = base depth * confirmation quality
  const raw = depthFactor * 0.7 + confirmRate * 0.3;
  return Math.min(maxScore, raw * maxScore);
}

/**
 * Breadth: How many different aspects does the reasoning cover?
 * Rewards coverage of assumptions, tradeoffs, risks.
 */
function scoreBreadth(result: StrategyResult, maxScore: number): number {
  const aspects = [
    result.assumptions.length > 0 ? 1 : 0,           // Has assumptions
    result.tradeoffs.length > 0 ? 1 : 0,              // Has tradeoffs
    result.risks.length > 0 ? 1 : 0,                  // Has risks
    result.reasoning.some(s => s.evidence) ? 1 : 0,   // Has evidence
    result.reasoning.some(s => s.hypothesis) ? 1 : 0,  // Has hypotheses
    result.confidence > 0 ? 1 : 0,                     // Has confidence
  ];

  const coverage = aspects.reduce((sum, a) => sum + a, 0) / aspects.length;

  // Bonus for quantity within each aspect
  const quantityBonus = Math.min(0.3,
    (result.assumptions.length * 0.05) +
    (result.tradeoffs.length * 0.05) +
    (result.risks.length * 0.05)
  );

  return Math.min(maxScore, (coverage + quantityBonus) * maxScore);
}

/**
 * Novelty: How unique is this result compared to others in the same round?
 * Rewards conclusions that differ from the pack.
 */
function scoreNovelty(result: StrategyResult, allResults: StrategyResult[], maxScore: number): number {
  if (allResults.length <= 1) return maxScore * 0.5; // Default for single result

  // Calculate conclusion similarity with other results
  const otherConclusions = allResults
    .filter(r => r.strategyName !== result.strategyName)
    .map(r => r.conclusion);

  const similarities = otherConclusions.map(other => {
    return textSimilarity(result.conclusion, other);
  });

  const avgSimilarity = similarities.length > 0
    ? similarities.reduce((a, b) => a + b, 0) / similarities.length
    : 0;

  // Novelty is inversely correlated with similarity
  // But very low similarity (completely unrelated) is also penalized
  const noveltyFactor = avgSimilarity < 0.1
    ? 0.4  // Too divergent, may be off-topic
    : avgSimilarity > 0.8
      ? 0.2  // Too similar, not adding new perspective
      : 1 - avgSimilarity; // Sweet spot: related but different

  // Bonus for unique assumptions not found in other strategies
  const allOtherAssumptions = allResults
    .filter(r => r.strategyName !== result.strategyName)
    .flatMap(r => r.assumptions);
  const uniqueAssumptions = result.assumptions.filter(a =>
    !allOtherAssumptions.some(other => textSimilarity(a, other) > 0.6)
  );
  const uniquenessBonus = Math.min(0.2, uniqueAssumptions.length * 0.05);

  return Math.min(maxScore, (noveltyFactor + uniquenessBonus) * maxScore);
}

/**
 * Rigor: How well-supported are the conclusions?
 * Rewards evidence-based steps, hypothesis testing, and validated assumptions.
 */
function scoreRigor(result: StrategyResult, maxScore: number): number {
  const steps = result.reasoning;
  if (steps.length === 0) return 0;

  // Evidence density: what fraction of steps have evidence?
  const evidenceSteps = steps.filter(s => s.evidence).length;
  const evidenceDensity = evidenceSteps / steps.length;

  // Hypothesis testing: what fraction of steps test hypotheses?
  const hypothesisSteps = steps.filter(s => s.hypothesis && s.verdict).length;
  const hypothesisRate = hypothesisSteps / steps.length;

  // Verdict distribution: are we testing and sometimes refuting?
  const refutedSteps = steps.filter(s => s.verdict === 'refuted').length;
  const hasRefutation = refutedSteps > 0 ? 0.15 : 0; // Bonus for intellectual honesty

  // Confidence calibration: is confidence proportional to evidence?
  const expectedConfidence = (evidenceDensity * 0.5 + hypothesisRate * 0.5) * 100;
  const calibrationError = Math.abs(result.confidence - expectedConfidence) / 100;
  const calibrationScore = Math.max(0, 1 - calibrationError);

  const raw = evidenceDensity * 0.3 + hypothesisRate * 0.3 + calibrationScore * 0.25 + hasRefutation;
  return Math.min(maxScore, raw * maxScore);
}

/**
 * Actionability: How implementable is the conclusion?
 * Rewards concrete, specific conclusions over vague generalities.
 */
function scoreActionability(result: StrategyResult, maxScore: number): number {
  const conclusion = result.conclusion;

  // Specificity indicators
  const hasNumbers = /\d+/.test(conclusion) ? 0.15 : 0;
  const hasConcreteNouns = /(function|class|module|API|database|component|service)/i.test(conclusion) ? 0.15 : 0;
  const hasActionVerbs = /(implement|create|refactor|deploy|test|configure|migrate)/i.test(conclusion) ? 0.15 : 0;
  const hasTimeline = /(phase|step|first|then|after|before|week|day)/i.test(conclusion) ? 0.1 : 0;

  // Tradeoff awareness (understanding costs)
  const tradeoffAwareness = result.tradeoffs.length > 0
    ? Math.min(0.2, result.tradeoffs.length * 0.1)
    : 0;

  // Risk awareness (understanding what could go wrong)
  const riskAwareness = result.risks.length > 0
    ? Math.min(0.15, result.risks.length * 0.075)
    : 0;

  // Conclusion length: not too short, not too long
  const words = conclusion.split(' ').length;
  const lengthScore = words > 10 && words < 100 ? 0.1 : 0;

  const raw = hasNumbers + hasConcreteNouns + hasActionVerbs + hasTimeline +
    tradeoffAwareness + riskAwareness + lengthScore;
  return Math.min(maxScore, raw * maxScore);
}

// ─── Utilities ─────────────────────────────────────────────────────────

/**
 * Simple text similarity using Jaccard index on word sets.
 * Returns 0-1 where 1 is identical.
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Update strategy weights based on performance history.
 * Winners get weight boosts, losers get slight penalties.
 * Uses exponential moving average to prevent wild swings.
 */
export function updateStrategyWeights(
  currentWeights: Record<StrategyName, number>,
  rankedResults: ScoredResult[],
  learningRate: number = 0.1
): Record<StrategyName, number> {
  const updated = { ...currentWeights };
  const n = rankedResults.length;

  for (const result of rankedResults) {
    // Position-based reward: rank 1 gets positive, last gets negative
    const positionScore = 1 - (2 * (result.rank - 1)) / Math.max(1, n - 1); // 1 to -1
    const adjustment = positionScore * learningRate;

    updated[result.strategyName] = Math.max(0.5, Math.min(2.0,
      (updated[result.strategyName] || 1.0) + adjustment
    ));
  }

  return updated;
}
