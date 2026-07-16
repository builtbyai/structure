/**
 * Parallel Think Engine
 *
 * Multi-strategy parallel reasoning with endless improvement loop.
 *
 * Usage:
 *   import { think, formatReport } from './parallel-think/index.js';
 *
 *   const history = await think({
 *     id: 'arch-decision-001',
 *     statement: 'Should we use microservices or monolith?',
 *     constraints: ['Team of 5', 'Must ship in 3 months'],
 *     domain: 'backend architecture',
 *   });
 *
 *   console.log(formatReport(history));
 */

export { think, DEFAULT_CONFIG } from './engine.js';
export type { ProgressCallback, ProgressEvent } from './engine.js';
export { formatReport, formatRoundProgress } from './reporter.js';
export { STRATEGIES } from './strategies.js';
export { scoreResult, rankResults, updateStrategyWeights } from './scorer.js';
export type {
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
  ScoreBreakdown,
  ReasoningStep,
  Tradeoff,
} from './types.js';
