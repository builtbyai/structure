/**
 * Parallel Think Engine - Type Definitions
 *
 * Core types for the multi-strategy parallel reasoning system.
 */

export type StrategyName =
  | 'first-principles'
  | 'inversion'
  | 'constraint-analysis'
  | 'adversarial'
  | 'analogical'
  | 'decomposition'
  | 'simulation';

export interface ThinkingProblem {
  id: string;
  statement: string;
  context?: string;
  constraints?: string[];
  domain?: string;
  maxIterations?: number;
  targetConfidence?: number;
}

export interface StrategyResult {
  strategyName: StrategyName;
  reasoning: ReasoningStep[];
  conclusion: string;
  confidence: number;          // 0-100
  assumptions: string[];
  tradeoffs: Tradeoff[];
  risks: string[];
  executionTimeMs: number;
  iterationBorn: number;       // which improvement iteration produced this
}

export interface ReasoningStep {
  step: number;
  description: string;
  evidence?: string;
  hypothesis?: string;
  verdict?: 'confirmed' | 'refuted' | 'inconclusive';
}

export interface Tradeoff {
  option: string;
  pros: string[];
  cons: string[];
  weight: number;              // -1 to 1 (net assessment)
}

export interface ScoredResult extends StrategyResult {
  scores: ScoreBreakdown;
  totalScore: number;
  rank: number;
}

export interface ScoreBreakdown {
  depth: number;               // reasoning depth (0-25)
  breadth: number;             // considerations covered (0-20)
  novelty: number;             // unique insights vs other strategies (0-20)
  rigor: number;               // evidence quality & assumption validation (0-20)
  actionability: number;       // how implementable is the conclusion (0-15)
}

export interface ImprovementRound {
  roundNumber: number;
  timestamp: number;
  problem: ThinkingProblem;
  results: ScoredResult[];
  winner: ScoredResult;
  synthesized: SynthesizedResult;
  metrics: RoundMetrics;
  strategyWeights: Record<StrategyName, number>;
}

export interface SynthesizedResult {
  conclusion: string;
  confidence: number;
  keyInsights: string[];
  consensusPoints: string[];
  dissensionPoints: string[];
  blindSpots: string[];
  recommendation: string;
}

export interface RoundMetrics {
  totalTimeMs: number;
  avgConfidence: number;
  maxConfidence: number;
  confidenceSpread: number;    // max - min (measures disagreement)
  improvementOverPrevious: number; // delta in winner score
  convergenceRate: number;     // how much strategies are aligning
  diversityIndex: number;      // Shannon entropy of conclusions
}

export interface EngineConfig {
  strategies: StrategyName[];
  maxParallel: number;
  scoringWeights: Partial<ScoreBreakdown>;
  improvementTarget: number;   // stop when winner score exceeds this
  maxRounds: number;
  feedbackDepth: number;       // how many prior rounds to feed back
}

export interface ImprovementHistory {
  problemId: string;
  rounds: ImprovementRound[];
  totalTimeMs: number;
  finalResult: SynthesizedResult;
  convergenceAchieved: boolean;
  strategyPerformance: Record<StrategyName, StrategyStats>;
}

export interface StrategyStats {
  timesRun: number;
  timesWon: number;
  avgScore: number;
  bestScore: number;
  avgConfidence: number;
  avgExecutionTimeMs: number;
}
