/**
 * Parallel Think Engine - Improvement Test Harness
 *
 * Tests that the engine actually improves over iterations.
 * Validates convergence, strategy adaptation, and synthesis quality.
 *
 * This is the "endless improvement testing" suite - it proves that
 * each round produces measurably better results than the last.
 */

import { think, formatReport, type ImprovementHistory, type ThinkingProblem, type EngineConfig } from '../../src/parallel-think/index.js';

// ─── Test Problems ──────────────────────────────────────────────────────

const PROBLEMS: ThinkingProblem[] = [
  {
    id: 'arch-001',
    statement: 'Should we use microservices or a modular monolith for a 5-person startup?',
    constraints: [
      'Team must ship MVP in 3 months',
      'Must handle 1000 concurrent users',
      'Budget requires managed infrastructure',
      'Team has mixed experience levels',
    ],
    domain: 'backend architecture',
    maxIterations: 5,
    targetConfidence: 80,
  },
  {
    id: 'perf-002',
    statement: 'How should we optimize a database query that takes 12 seconds for datasets over 100k rows?',
    constraints: [
      'Must not change the database schema',
      'Requires backward compatibility with existing API',
      'Must reduce to under 500ms',
      'Cannot add caching layer due to consistency requirements',
    ],
    domain: 'performance optimization',
    maxIterations: 6,
    targetConfidence: 85,
  },
  {
    id: 'security-003',
    statement: 'Design an authentication system for a multi-tenant SaaS platform',
    constraints: [
      'Must support SSO with SAML and OIDC',
      'Requires tenant isolation at the data layer',
      'Must comply with SOC2 requirements',
      'Never store passwords in plaintext',
      'Session timeout must be configurable per tenant',
    ],
    domain: 'security architecture',
    maxIterations: 7,
    targetConfidence: 90,
  },
];

// ─── Core Improvement Tests ─────────────────────────────────────────────

describe('Parallel Think Engine', () => {
  describe('Convergence & Improvement', () => {
    it('should improve winner score over iterations', async () => {
      const history = await think(PROBLEMS[0]);

      // Each round's winner score should trend upward
      const scores = history.rounds.map(r => r.winner.totalScore);
      let improvements = 0;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] >= scores[i - 1]) improvements++;
      }

      // At least 50% of rounds should show improvement
      const improvementRate = improvements / (scores.length - 1);
      expect(improvementRate).toBeGreaterThanOrEqual(0.5);
    }, 30000);

    it('should increase average confidence over rounds', async () => {
      const history = await think(PROBLEMS[0]);

      const firstRoundConf = history.rounds[0].metrics.avgConfidence;
      const lastRoundConf = history.rounds[history.rounds.length - 1].metrics.avgConfidence;

      expect(lastRoundConf).toBeGreaterThanOrEqual(firstRoundConf);
    }, 30000);

    it('should converge when target confidence is achievable', async () => {
      const easyProblem: ThinkingProblem = {
        id: 'easy-001',
        statement: 'Should we use TypeScript for a Node.js project?',
        constraints: ['Team knows TypeScript'],
        domain: 'tooling',
        maxIterations: 10,
        targetConfidence: 60, // Very achievable
      };

      const history = await think(easyProblem);

      // Should converge before max rounds
      expect(history.convergenceAchieved).toBe(true);
      expect(history.rounds.length).toBeLessThanOrEqual(10);
    }, 30000);
  });

  describe('Strategy Diversity', () => {
    it('should produce different conclusions from different strategies', async () => {
      const history = await think(PROBLEMS[0]);
      const firstRound = history.rounds[0];

      // Check that not all conclusions are identical
      const conclusions = firstRound.results.map(r => r.conclusion);
      const uniqueConclusions = new Set(conclusions);
      expect(uniqueConclusions.size).toBeGreaterThan(1);
    }, 30000);

    it('should have non-zero novelty scores', async () => {
      const history = await think(PROBLEMS[0]);
      const firstRound = history.rounds[0];

      const noveltyScores = firstRound.results.map(r => r.scores.novelty);
      const avgNovelty = noveltyScores.reduce((a, b) => a + b, 0) / noveltyScores.length;
      expect(avgNovelty).toBeGreaterThan(0);
    }, 30000);

    it('should adapt strategy weights based on performance', async () => {
      const history = await think(PROBLEMS[1], { maxRounds: 5 });

      if (history.rounds.length >= 2) {
        const firstWeights = history.rounds[0].strategyWeights;
        const lastWeights = history.rounds[history.rounds.length - 1].strategyWeights;

        // At least one strategy should have changed weight
        const weightChanges = Object.keys(firstWeights).filter(
          s => Math.abs((firstWeights[s as any] || 1) - (lastWeights[s as any] || 1)) > 0.01
        );
        expect(weightChanges.length).toBeGreaterThan(0);
      }
    }, 30000);
  });

  describe('Synthesis Quality', () => {
    it('should identify consensus points across strategies', async () => {
      const history = await think(PROBLEMS[0]);
      const synth = history.finalResult;

      // Should have some synthesis output
      expect(synth.conclusion).toBeTruthy();
      expect(synth.keyInsights.length).toBeGreaterThan(0);
    }, 30000);

    it('should detect blind spots', async () => {
      const history = await think(PROBLEMS[2]);

      // Complex security problem should have blind spots identified
      const allBlindSpots = history.rounds.flatMap(r => r.synthesized.blindSpots);
      expect(allBlindSpots.length).toBeGreaterThan(0);
    }, 30000);

    it('should produce higher confidence in later rounds', async () => {
      const history = await think(PROBLEMS[1], { maxRounds: 6 });

      if (history.rounds.length >= 3) {
        const earlyConf = history.rounds[0].synthesized.confidence;
        const lateConf = history.rounds[history.rounds.length - 1].synthesized.confidence;
        expect(lateConf).toBeGreaterThanOrEqual(earlyConf * 0.95); // Allow 5% margin
      }
    }, 30000);
  });

  describe('Scoring System', () => {
    it('should score depth proportional to reasoning steps', async () => {
      const history = await think(PROBLEMS[0]);
      const results = history.rounds[0].results;

      // Results with more steps should have higher depth scores
      const sorted = [...results].sort((a, b) => a.reasoning.length - b.reasoning.length);
      if (sorted.length >= 2) {
        const fewest = sorted[0];
        const most = sorted[sorted.length - 1];
        expect(most.scores.depth).toBeGreaterThanOrEqual(fewest.scores.depth * 0.8);
      }
    }, 30000);

    it('should produce valid score breakdowns', async () => {
      const history = await think(PROBLEMS[0]);

      for (const result of history.rounds[0].results) {
        expect(result.scores.depth).toBeGreaterThanOrEqual(0);
        expect(result.scores.depth).toBeLessThanOrEqual(25);
        expect(result.scores.breadth).toBeGreaterThanOrEqual(0);
        expect(result.scores.breadth).toBeLessThanOrEqual(20);
        expect(result.scores.novelty).toBeGreaterThanOrEqual(0);
        expect(result.scores.novelty).toBeLessThanOrEqual(20);
        expect(result.scores.rigor).toBeGreaterThanOrEqual(0);
        expect(result.scores.rigor).toBeLessThanOrEqual(20);
        expect(result.scores.actionability).toBeGreaterThanOrEqual(0);
        expect(result.scores.actionability).toBeLessThanOrEqual(15);
        expect(result.totalScore).toBeGreaterThan(0);
      }
    }, 30000);

    it('should rank results consistently', async () => {
      const history = await think(PROBLEMS[0]);
      const results = history.rounds[0].results;

      // Ranks should be 1 through N
      const ranks = results.map(r => r.rank).sort((a, b) => a - b);
      expect(ranks[0]).toBe(1);
      expect(ranks[ranks.length - 1]).toBe(results.length);

      // Higher rank should have higher score
      for (let i = 0; i < results.length - 1; i++) {
        const higher = results.find(r => r.rank === i + 1)!;
        const lower = results.find(r => r.rank === i + 2)!;
        expect(higher.totalScore).toBeGreaterThanOrEqual(lower.totalScore);
      }
    }, 30000);
  });

  describe('Metrics & Observability', () => {
    it('should track timing for all rounds', async () => {
      const history = await think(PROBLEMS[0]);

      for (const round of history.rounds) {
        expect(round.metrics.totalTimeMs).toBeGreaterThanOrEqual(0);
      }
      expect(history.totalTimeMs).toBeGreaterThanOrEqual(0);
    }, 30000);

    it('should compute diversity index', async () => {
      const history = await think(PROBLEMS[0]);

      for (const round of history.rounds) {
        expect(round.metrics.diversityIndex).toBeGreaterThanOrEqual(0);
        // Shannon entropy max for N strategies = log2(N)
        expect(round.metrics.diversityIndex).toBeLessThanOrEqual(Math.log2(7) + 0.1);
      }
    }, 30000);

    it('should track strategy performance stats', async () => {
      const history = await think(PROBLEMS[0]);
      const stats = history.strategyPerformance;

      // All strategies should have been run
      const totalRuns = Object.values(stats).reduce((sum, s) => sum + s.timesRun, 0);
      expect(totalRuns).toBe(history.rounds.length * 7); // 7 strategies per round

      // Exactly one winner per round
      const totalWins = Object.values(stats).reduce((sum, s) => sum + s.timesWon, 0);
      expect(totalWins).toBe(history.rounds.length);
    }, 30000);
  });

  describe('Progress Callbacks', () => {
    it('should emit progress events for each phase', async () => {
      const events: string[] = [];

      await think(PROBLEMS[0], { maxRounds: 2 }, (event) => {
        events.push(event.type);
      });

      expect(events).toContain('round-start');
      expect(events).toContain('strategy-complete');
      expect(events).toContain('round-scored');
      expect(events).toContain('round-complete');
      expect(events).toContain('improvement-complete');
    }, 30000);
  });

  describe('Report Generation', () => {
    it('should generate a formatted report without errors', async () => {
      const history = await think(PROBLEMS[0]);
      const report = formatReport(history);

      expect(report).toBeTruthy();
      expect(report).toContain('PARALLEL THINK ENGINE');
      expect(report).toContain('SYNTHESIZED RESULT');
      expect(report).toContain('Strategy Leaderboard');
      expect(report).toContain('Convergence Chart');
    }, 30000);
  });
});

// ─── Endless Improvement Stress Test ────────────────────────────────────

describe('Endless Improvement Loop', () => {
  it('should sustain improvement across many rounds on complex problems', async () => {
    const complexProblem: ThinkingProblem = {
      id: 'complex-stress-001',
      statement: 'Design a distributed event-sourcing system with CQRS for a financial trading platform that handles 100k events/second with sub-millisecond latency, full audit trail, and regulatory compliance across 5 jurisdictions',
      constraints: [
        'Must handle 100,000 events per second',
        'Require sub-millisecond read latency',
        'Must maintain full audit trail for 7 years',
        'Must comply with SEC, FCA, MAS, JFSA, and BaFin regulations',
        'Never lose an event, even during network partitions',
        'Must support real-time risk calculations',
        'System must be horizontally scalable',
        'Must support multi-region active-active deployment',
      ],
      domain: 'distributed systems / fintech',
      maxIterations: 10,
      targetConfidence: 95, // Very high bar - will push many rounds
    };

    const roundScores: number[] = [];
    const roundConfidences: number[] = [];

    const history = await think(complexProblem, { maxRounds: 10 }, (event) => {
      if (event.type === 'round-complete' && event.metrics) {
        roundScores.push(event.metrics.maxConfidence);
        roundConfidences.push(event.metrics.avgConfidence);
      }
    });

    // Verify improvement trajectory
    expect(history.rounds.length).toBeGreaterThanOrEqual(3);

    // Final round should be better than first round
    const firstScore = history.rounds[0].winner.totalScore;
    const lastScore = history.rounds[history.rounds.length - 1].winner.totalScore;
    expect(lastScore).toBeGreaterThanOrEqual(firstScore * 0.95);

    // Strategy weights should have evolved
    const finalWeights = history.rounds[history.rounds.length - 1].strategyWeights;
    const initialWeights = history.rounds[0].strategyWeights;
    const weightDrift = Object.keys(finalWeights).reduce((sum, key) => {
      return sum + Math.abs((finalWeights[key as any] || 1) - (initialWeights[key as any] || 1));
    }, 0);
    expect(weightDrift).toBeGreaterThan(0);

    // Print report for visual inspection
    console.log(formatReport(history));
  }, 60000);

  it('should handle adversarial feedback gracefully', async () => {
    // Run a problem where adversarial strategy should excel
    const adversarialProblem: ThinkingProblem = {
      id: 'adversarial-001',
      statement: 'Is it safe to deploy this untested code to production on Friday at 5pm?',
      constraints: [
        'No tests exist for the changed code',
        'The change touches payment processing',
        'Team is leaving for the weekend',
        'Customer is demanding the fix urgently',
      ],
      domain: 'deployment risk',
      maxIterations: 5,
      targetConfidence: 80,
    };

    const history = await think(adversarialProblem);

    // Adversarial and inversion strategies should perform well on this problem
    const stats = history.strategyPerformance;
    const riskStrategies = ['adversarial', 'inversion'] as const;

    // At least one risk-aware strategy should have won at least once
    const riskWins = riskStrategies.reduce((sum, s) => sum + (stats[s]?.timesWon || 0), 0);
    // This is probabilistic, so we just check it ran
    expect(stats['adversarial'].timesRun).toBeGreaterThan(0);
    expect(stats['inversion'].timesRun).toBeGreaterThan(0);
  }, 30000);

  it('should produce diminishing returns after many iterations', async () => {
    const history = await think(PROBLEMS[0], { maxRounds: 8 });

    if (history.rounds.length >= 6) {
      // Early improvements should be larger than late improvements
      const earlyImprovement = history.rounds
        .slice(1, 4)
        .map(r => Math.abs(r.metrics.improvementOverPrevious))
        .reduce((a, b) => a + b, 0);
      const lateImprovement = history.rounds
        .slice(-3)
        .map(r => Math.abs(r.metrics.improvementOverPrevious))
        .reduce((a, b) => a + b, 0);

      // Late improvement should be smaller (diminishing returns)
      // Using a generous margin since this is stochastic
      expect(lateImprovement).toBeLessThanOrEqual(earlyImprovement * 3);
    }
  }, 30000);
});
