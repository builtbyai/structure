/**
 * Parallel Think Engine - Visual Reporter
 *
 * Produces rich terminal-formatted reports of thinking results.
 * Includes round-by-round progress, strategy leaderboards,
 * and convergence visualization.
 */

import type {
  ImprovementHistory,
  ImprovementRound,
  ScoredResult,
  RoundMetrics,
  StrategyName,
  StrategyStats,
} from './types.js';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgGreen: '\x1b[42m',
};

const STRATEGY_ICONS: Record<StrategyName, string> = {
  'first-principles': 'FP',
  'inversion': 'IV',
  'constraint-analysis': 'CA',
  'adversarial': 'AD',
  'analogical': 'AN',
  'decomposition': 'DC',
  'simulation': 'SM',
};

/**
 * Format a complete improvement history as a terminal report.
 */
export function formatReport(history: ImprovementHistory): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(formatHeader('PARALLEL THINK ENGINE - IMPROVEMENT REPORT'));
  lines.push('');
  lines.push(formatSummary(history));
  lines.push('');
  lines.push(formatConvergenceChart(history));
  lines.push('');
  lines.push(formatStrategyLeaderboard(history));
  lines.push('');

  // Show each round in detail
  for (const round of history.rounds) {
    lines.push(formatRoundDetail(round, history.rounds.length));
  }

  lines.push('');
  lines.push(formatFinalSynthesis(history));
  lines.push('');
  lines.push(formatStrategyEvolution(history));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a single round's progress (for live updates).
 */
export function formatRoundProgress(round: ImprovementRound, totalRounds: number): string {
  const lines: string[] = [];
  const pct = (round.roundNumber / totalRounds * 100).toFixed(0);

  lines.push(`${COLORS.cyan}--- Round ${round.roundNumber}/${totalRounds} (${pct}%) ---${COLORS.reset}`);
  lines.push(`  Winner: ${COLORS.green}${round.winner.strategyName}${COLORS.reset} (score: ${round.winner.totalScore.toFixed(1)})`);
  lines.push(`  Avg confidence: ${formatConfidence(round.metrics.avgConfidence)}`);
  lines.push(`  Improvement: ${formatDelta(round.metrics.improvementOverPrevious)}`);
  lines.push(`  Diversity: ${formatBar(round.metrics.diversityIndex / 3, 20)}`);
  lines.push(`  Time: ${round.metrics.totalTimeMs}ms`);

  return lines.join('\n');
}

// ─── Formatting Functions ──────────────────────────────────────────────

function formatHeader(text: string): string {
  const width = 64;
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  const line = '='.repeat(width);
  return [
    `${COLORS.bgBlue}${COLORS.white}${line}${COLORS.reset}`,
    `${COLORS.bgBlue}${COLORS.white}${' '.repeat(pad)}${text}${' '.repeat(width - pad - text.length)}${COLORS.reset}`,
    `${COLORS.bgBlue}${COLORS.white}${line}${COLORS.reset}`,
  ].join('\n');
}

function formatSummary(history: ImprovementHistory): string {
  const lines: string[] = [];
  const final = history.rounds[history.rounds.length - 1];

  lines.push(`${COLORS.bold}Problem:${COLORS.reset} ${history.problemId}`);
  lines.push(`${COLORS.bold}Rounds:${COLORS.reset} ${history.rounds.length}`);
  lines.push(`${COLORS.bold}Total Time:${COLORS.reset} ${history.totalTimeMs}ms`);
  lines.push(`${COLORS.bold}Converged:${COLORS.reset} ${history.convergenceAchieved ? `${COLORS.green}YES${COLORS.reset}` : `${COLORS.yellow}NO${COLORS.reset}`}`);
  lines.push(`${COLORS.bold}Final Winner:${COLORS.reset} ${COLORS.green}${final.winner.strategyName}${COLORS.reset} (score: ${final.winner.totalScore.toFixed(1)}, confidence: ${final.winner.confidence}%)`);
  lines.push(`${COLORS.bold}Strategies Used:${COLORS.reset} ${history.rounds[0].results.length}`);

  return lines.join('\n');
}

function formatConvergenceChart(history: ImprovementHistory): string {
  const lines: string[] = [];
  lines.push(`${COLORS.bold}Convergence Chart:${COLORS.reset}`);
  lines.push('');

  const maxScore = Math.max(...history.rounds.map(r => r.winner.totalScore));
  const chartWidth = 50;

  for (const round of history.rounds) {
    const score = round.winner.totalScore;
    const barLen = Math.round((score / Math.max(maxScore, 1)) * chartWidth);
    const bar = formatBar(score / Math.max(maxScore, 1), chartWidth);
    const icon = STRATEGY_ICONS[round.winner.strategyName] || '??';

    lines.push(
      `  R${String(round.roundNumber).padStart(2, '0')} [${icon}] ${bar} ${score.toFixed(1)} (${formatDelta(round.metrics.improvementOverPrevious)})`
    );
  }

  return lines.join('\n');
}

function formatStrategyLeaderboard(history: ImprovementHistory): string {
  const lines: string[] = [];
  lines.push(`${COLORS.bold}Strategy Leaderboard:${COLORS.reset}`);
  lines.push('');
  lines.push(`  ${'Strategy'.padEnd(22)} ${'Wins'.padStart(5)} ${'Avg Score'.padStart(10)} ${'Best'.padStart(8)} ${'Avg Conf'.padStart(9)} ${'Avg Time'.padStart(10)}`);
  lines.push(`  ${'─'.repeat(22)} ${'─'.repeat(5)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(10)}`);

  const entries = Object.entries(history.strategyPerformance) as [StrategyName, StrategyStats][];
  entries.sort((a, b) => b[1].avgScore - a[1].avgScore);

  for (const [name, stats] of entries) {
    if (stats.timesRun === 0) continue;
    const medal = stats.timesWon > 0 && entries.indexOf([name, stats]) === 0 ? `${COLORS.yellow}*${COLORS.reset}` : ' ';
    lines.push(
      `  ${medal}${name.padEnd(21)} ${String(stats.timesWon).padStart(5)} ${stats.avgScore.toFixed(1).padStart(10)} ${stats.bestScore.toFixed(1).padStart(8)} ${stats.avgConfidence.toFixed(1).padStart(8)}% ${(stats.avgExecutionTimeMs.toFixed(0) + 'ms').padStart(10)}`
    );
  }

  return lines.join('\n');
}

function formatRoundDetail(round: ImprovementRound, totalRounds: number): string {
  const lines: string[] = [];
  const m = round.metrics;

  lines.push(`${COLORS.cyan}${'─'.repeat(64)}${COLORS.reset}`);
  lines.push(`${COLORS.bold}Round ${round.roundNumber}/${totalRounds}${COLORS.reset} | Time: ${m.totalTimeMs}ms | Diversity: ${m.diversityIndex.toFixed(2)} | Convergence: ${(m.convergenceRate * 100).toFixed(1)}%`);
  lines.push('');

  for (const result of round.results) {
    const icon = result.rank === 1 ? `${COLORS.green}>>` : `${COLORS.dim}  `;
    const rankBadge = result.rank === 1 ? `${COLORS.bgGreen}${COLORS.white} #${result.rank} ${COLORS.reset}` : `${COLORS.dim} #${result.rank} ${COLORS.reset}`;
    lines.push(
      `${icon} ${rankBadge} ${result.strategyName.padEnd(20)} Score: ${result.totalScore.toFixed(1).padStart(6)} | Conf: ${result.confidence}% | Steps: ${result.reasoning.length}${COLORS.reset}`
    );
    lines.push(
      `${COLORS.dim}     D:${result.scores.depth.toFixed(1)} B:${result.scores.breadth.toFixed(1)} N:${result.scores.novelty.toFixed(1)} R:${result.scores.rigor.toFixed(1)} A:${result.scores.actionability.toFixed(1)}${COLORS.reset}`
    );
  }

  return lines.join('\n');
}

function formatFinalSynthesis(history: ImprovementHistory): string {
  const lines: string[] = [];
  const synth = history.finalResult;

  lines.push(formatHeader('SYNTHESIZED RESULT'));
  lines.push('');
  lines.push(`${COLORS.bold}Conclusion:${COLORS.reset}`);
  lines.push(`  ${synth.conclusion}`);
  lines.push('');
  lines.push(`${COLORS.bold}Confidence:${COLORS.reset} ${formatConfidence(synth.confidence)}`);
  lines.push('');

  if (synth.keyInsights.length > 0) {
    lines.push(`${COLORS.bold}Key Insights:${COLORS.reset}`);
    synth.keyInsights.forEach(i => lines.push(`  - ${i}`));
    lines.push('');
  }

  if (synth.consensusPoints.length > 0) {
    lines.push(`${COLORS.green}Consensus Points:${COLORS.reset}`);
    synth.consensusPoints.forEach(p => lines.push(`  + ${p}`));
    lines.push('');
  }

  if (synth.dissensionPoints.length > 0) {
    lines.push(`${COLORS.yellow}Dissension Points:${COLORS.reset}`);
    synth.dissensionPoints.forEach(p => lines.push(`  ~ ${p}`));
    lines.push('');
  }

  if (synth.blindSpots.length > 0) {
    lines.push(`${COLORS.red}Blind Spots:${COLORS.reset}`);
    synth.blindSpots.forEach(b => lines.push(`  ! ${b}`));
    lines.push('');
  }

  lines.push(`${COLORS.bold}Recommendation:${COLORS.reset}`);
  lines.push(`  ${synth.recommendation}`);

  return lines.join('\n');
}

function formatStrategyEvolution(history: ImprovementHistory): string {
  const lines: string[] = [];
  lines.push(`${COLORS.bold}Strategy Weight Evolution:${COLORS.reset}`);
  lines.push('');

  if (history.rounds.length < 2) {
    lines.push('  (Need 2+ rounds to show evolution)');
    return lines.join('\n');
  }

  const strategies = Object.keys(history.rounds[0].strategyWeights) as StrategyName[];

  for (const strategy of strategies) {
    const weights = history.rounds.map(r => r.strategyWeights[strategy] || 1.0);
    const trend = weights[weights.length - 1] - weights[0];
    const trendIcon = trend > 0.1 ? `${COLORS.green}^` : trend < -0.1 ? `${COLORS.red}v` : `${COLORS.dim}=`;
    const sparkline = weights.map(w => {
      if (w > 1.3) return '#';
      if (w > 1.1) return '|';
      if (w > 0.9) return '.';
      if (w > 0.7) return ',';
      return '_';
    }).join('');

    lines.push(`  ${STRATEGY_ICONS[strategy]} ${strategy.padEnd(22)} [${sparkline}] ${trendIcon} ${weights[weights.length - 1].toFixed(2)}${COLORS.reset}`);
  }

  return lines.join('\n');
}

// ─── Utility Formatters ────────────────────────────────────────────────

function formatConfidence(confidence: number): string {
  if (confidence >= 80) return `${COLORS.green}${confidence.toFixed(1)}% (High)${COLORS.reset}`;
  if (confidence >= 50) return `${COLORS.yellow}${confidence.toFixed(1)}% (Medium)${COLORS.reset}`;
  return `${COLORS.red}${confidence.toFixed(1)}% (Low)${COLORS.reset}`;
}

function formatDelta(delta: number): string {
  if (delta > 0) return `${COLORS.green}+${delta.toFixed(1)}${COLORS.reset}`;
  if (delta < 0) return `${COLORS.red}${delta.toFixed(1)}${COLORS.reset}`;
  return `${COLORS.dim}+0.0${COLORS.reset}`;
}

function formatBar(ratio: number, width: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * width);
  const empty = width - filled;
  const color = ratio > 0.7 ? COLORS.green : ratio > 0.4 ? COLORS.yellow : COLORS.red;
  return `${color}${'█'.repeat(filled)}${COLORS.dim}${'░'.repeat(empty)}${COLORS.reset}`;
}
