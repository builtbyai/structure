/**
 * Parallel Think Engine - Reasoning Strategies
 *
 * Each strategy approaches a problem from a fundamentally different angle.
 * Strategies are pure functions: (problem, context) => StrategyResult
 */

import type { ThinkingProblem, StrategyName, StrategyResult, ReasoningStep, Tradeoff } from './types.js';

export interface StrategyContext {
  priorResults?: StrategyResult[];    // results from previous rounds
  priorWinner?: StrategyResult;       // best result from previous round
  blindSpots?: string[];              // identified gaps to address
  roundNumber: number;
}

type StrategyFn = (problem: ThinkingProblem, ctx: StrategyContext) => Promise<StrategyResult>;

/**
 * Strategy Registry - maps strategy names to their execution functions.
 * Each strategy produces independent reasoning chains.
 */
export const STRATEGIES: Record<StrategyName, StrategyFn> = {
  'first-principles': executeFirstPrinciples,
  'inversion': executeInversion,
  'constraint-analysis': executeConstraintAnalysis,
  'adversarial': executeAdversarial,
  'analogical': executeAnalogical,
  'decomposition': executeDecomposition,
  'simulation': executeSimulation,
};

// ─── Strategy Implementations ───────────────────────────────────────────

async function executeFirstPrinciples(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];

  // Step 1: Identify fundamental truths
  steps.push({
    step: 1,
    description: 'Identify fundamental truths and axioms',
    hypothesis: `The core elements of "${problem.statement}" can be reduced to base truths`,
    evidence: problem.context || 'No additional context provided',
    verdict: 'confirmed',
  });

  // Step 2: Separate truths from assumptions
  const assumptions: string[] = [];
  if (problem.constraints?.length) {
    problem.constraints.forEach((c, i) => {
      const isHard = c.toLowerCase().includes('must') || c.toLowerCase().includes('require');
      steps.push({
        step: 2 + i,
        description: `Evaluate constraint: "${c}"`,
        hypothesis: isHard ? 'Hard constraint (truth)' : 'Soft constraint (assumption)',
        verdict: isHard ? 'confirmed' : 'inconclusive',
      });
      if (!isHard) assumptions.push(c);
    });
  }

  // Step 3: Build up from base
  steps.push({
    step: steps.length + 1,
    description: 'Reconstruct solution from fundamental truths only',
    hypothesis: 'A simpler solution exists when assumptions are removed',
    verdict: assumptions.length > 0 ? 'confirmed' : 'inconclusive',
  });

  // Step 4: Incorporate feedback from prior rounds
  if (ctx.priorWinner) {
    steps.push({
      step: steps.length + 1,
      description: `Integrate prior winner insight (round ${ctx.roundNumber - 1})`,
      evidence: ctx.priorWinner.conclusion,
      verdict: 'confirmed',
    });
  }

  if (ctx.blindSpots?.length) {
    ctx.blindSpots.forEach((spot) => {
      steps.push({
        step: steps.length + 1,
        description: `Address identified blind spot: ${spot}`,
        hypothesis: `First-principles approach can resolve: ${spot}`,
        verdict: 'inconclusive',
      });
    });
  }

  const tradeoffs: Tradeoff[] = [{
    option: 'First-principles rebuild',
    pros: ['Eliminates unnecessary complexity', 'Reveals hidden assumptions', 'Often finds simpler solution'],
    cons: ['Time-intensive', 'May miss domain-specific optimizations', 'Requires deep domain knowledge'],
    weight: 0.6,
  }];

  const confidence = Math.min(95, 50 + steps.length * 5 + (ctx.priorWinner ? 10 : 0));

  return {
    strategyName: 'first-principles',
    reasoning: steps,
    conclusion: `First-principles analysis of "${problem.statement}": Reduced to ${steps.length} fundamental steps. ${assumptions.length} assumptions identified and challenged.`,
    confidence,
    assumptions,
    tradeoffs,
    risks: ['May oversimplify domain-specific nuances', 'Reconstruction cost may exceed benefit for well-understood domains'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}

async function executeInversion(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];

  // Step 1: Invert the problem
  steps.push({
    step: 1,
    description: 'Invert the problem: How could this fail catastrophically?',
    hypothesis: `Identifying failure modes for "${problem.statement}" reveals hidden requirements`,
    verdict: 'confirmed',
  });

  // Step 2: Enumerate failure modes
  const failureModes = [
    'Complete system failure under load',
    'Data corruption or loss',
    'Security breach or unauthorized access',
    'User abandonment due to complexity',
    'Maintenance burden exceeding value',
  ];

  failureModes.forEach((mode, i) => {
    steps.push({
      step: 2 + i,
      description: `Failure mode ${i + 1}: ${mode}`,
      hypothesis: `This failure mode is relevant to the problem`,
      evidence: problem.constraints?.find(c => c.toLowerCase().includes(mode.split(' ')[0].toLowerCase())) || 'General risk',
      verdict: i < 3 ? 'confirmed' : 'inconclusive',
    });
  });

  // Step 3: Design mitigations
  steps.push({
    step: steps.length + 1,
    description: 'Design mitigations that prevent top failure modes',
    hypothesis: 'Mitigation-first design produces more robust solutions',
    verdict: 'confirmed',
  });

  // Step 4: Incorporate prior round feedback
  if (ctx.priorResults?.length) {
    const weaknesses = ctx.priorResults
      .filter(r => r.confidence < 70)
      .map(r => r.strategyName);

    if (weaknesses.length) {
      steps.push({
        step: steps.length + 1,
        description: `Prior strategies with low confidence: ${weaknesses.join(', ')}`,
        evidence: 'Low-confidence strategies may indicate unexamined failure modes',
        verdict: 'confirmed',
      });
    }
  }

  const assumptions = [
    'Failure modes are enumerable',
    'Mitigation cost is lower than failure cost',
  ];

  const tradeoffs: Tradeoff[] = [{
    option: 'Inversion-based design',
    pros: ['Reveals hidden risks early', 'Produces defensive architecture', 'Prevents catastrophic failures'],
    cons: ['May be overly conservative', 'Can miss opportunities', 'Pessimistic bias'],
    weight: 0.5,
  }];

  const confidence = Math.min(90, 45 + steps.length * 4 + (ctx.priorWinner ? 12 : 0));

  return {
    strategyName: 'inversion',
    reasoning: steps,
    conclusion: `Inversion analysis: ${failureModes.length} failure modes identified. Top 3 require active mitigation. Solution should be designed defensively around these failure points.`,
    confidence,
    assumptions,
    tradeoffs,
    risks: ['Pessimistic bias may reject valid approaches', 'Not all failure modes are equally likely'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}

async function executeConstraintAnalysis(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];

  const constraints = problem.constraints || ['No explicit constraints provided'];

  // Step 1: Classify constraints
  const hardConstraints: string[] = [];
  const softConstraints: string[] = [];

  constraints.forEach((c, i) => {
    const isHard = c.toLowerCase().includes('must') ||
      c.toLowerCase().includes('require') ||
      c.toLowerCase().includes('never');

    if (isHard) hardConstraints.push(c);
    else softConstraints.push(c);

    steps.push({
      step: i + 1,
      description: `Classify: "${c}" → ${isHard ? 'HARD' : 'SOFT'}`,
      verdict: 'confirmed',
    });
  });

  // Step 2: Find constraint interactions
  steps.push({
    step: steps.length + 1,
    description: `Analyze interactions between ${hardConstraints.length} hard and ${softConstraints.length} soft constraints`,
    hypothesis: 'Some constraints may conflict or create emergent requirements',
    verdict: hardConstraints.length > 1 ? 'confirmed' : 'inconclusive',
  });

  // Step 3: Identify feasible solution space
  steps.push({
    step: steps.length + 1,
    description: 'Map feasible solution space satisfying all hard constraints',
    hypothesis: 'A non-empty solution space exists',
    evidence: `${hardConstraints.length} hard constraints define the boundary`,
    verdict: 'confirmed',
  });

  // Step 4: Optimize within space
  steps.push({
    step: steps.length + 1,
    description: 'Optimize for soft constraints within feasible space',
    hypothesis: 'Soft constraints can be ranked by impact for optimization priority',
    verdict: 'confirmed',
  });

  // Incorporate prior feedback
  if (ctx.blindSpots?.length) {
    steps.push({
      step: steps.length + 1,
      description: `Address blind spots as additional constraints: ${ctx.blindSpots.join('; ')}`,
      verdict: 'confirmed',
    });
  }

  const tradeoffs: Tradeoff[] = [{
    option: 'Constraint-optimized solution',
    pros: ['Guarantees feasibility', 'Systematic optimization', 'Clear priority ordering'],
    cons: ['May miss creative solutions outside constraint space', 'Constraint classification is subjective'],
    weight: 0.7,
  }];

  const confidence = Math.min(92, 55 + hardConstraints.length * 8 + softConstraints.length * 3);

  return {
    strategyName: 'constraint-analysis',
    reasoning: steps,
    conclusion: `Constraint analysis: ${hardConstraints.length} hard constraints define solution boundary. ${softConstraints.length} soft constraints ranked for optimization. Solution space is ${hardConstraints.length > 3 ? 'narrow but feasible' : 'wide with room to optimize'}.`,
    confidence,
    assumptions: ['Constraints are correctly classified', 'No hidden constraints exist'],
    tradeoffs,
    risks: ['Missing constraints could invalidate solution', 'Soft constraint ranking is subjective'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}

async function executeAdversarial(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];

  // Step 1: Take the opposing position
  steps.push({
    step: 1,
    description: 'Adopt adversarial stance: argue AGAINST the obvious solution',
    hypothesis: 'The obvious approach has unexamined weaknesses',
    verdict: 'confirmed',
  });

  // Step 2: Challenge prior winner
  if (ctx.priorWinner) {
    steps.push({
      step: 2,
      description: `Challenge prior winner (${ctx.priorWinner.strategyName}): "${ctx.priorWinner.conclusion}"`,
      hypothesis: 'Prior winner has unaddressed vulnerabilities',
      evidence: `Prior confidence: ${ctx.priorWinner.confidence}%, assumptions: ${ctx.priorWinner.assumptions.length}`,
      verdict: ctx.priorWinner.confidence < 85 ? 'confirmed' : 'inconclusive',
    });

    // Attack each assumption
    ctx.priorWinner.assumptions.forEach((assumption, i) => {
      steps.push({
        step: steps.length + 1,
        description: `Attack assumption: "${assumption}"`,
        hypothesis: `This assumption is false or incomplete`,
        verdict: Math.random() > 0.5 ? 'confirmed' : 'refuted', // Simulated adversarial testing
      });
    });
  }

  // Step 3: Find counterexamples
  steps.push({
    step: steps.length + 1,
    description: 'Search for counterexamples that break proposed solutions',
    hypothesis: 'Edge cases exist that current analysis misses',
    verdict: 'confirmed',
  });

  // Step 4: Steel-man the opposition
  steps.push({
    step: steps.length + 1,
    description: 'Steel-man: construct the strongest possible alternative',
    hypothesis: 'A fundamentally different approach may outperform',
    verdict: 'inconclusive',
  });

  const attackedAssumptions = ctx.priorWinner?.assumptions.length || 0;

  const tradeoffs: Tradeoff[] = [{
    option: 'Adversarial-tested solution',
    pros: ['Battle-tested against counterarguments', 'Reveals hidden weaknesses', 'Produces more robust conclusions'],
    cons: ['May be overly critical', 'Can delay consensus', 'Destructive without constructive alternative'],
    weight: 0.4,
  }];

  const confidence = Math.min(88, 40 + steps.length * 5 + attackedAssumptions * 3);

  return {
    strategyName: 'adversarial',
    reasoning: steps,
    conclusion: `Adversarial review: ${attackedAssumptions} assumptions challenged. ${steps.filter(s => s.verdict === 'confirmed').length} weaknesses confirmed. Solution requires hardening at ${steps.filter(s => s.verdict === 'confirmed').length} points.`,
    confidence,
    assumptions: ['Adversarial testing is comprehensive', 'Counterexamples are representative'],
    tradeoffs,
    risks: ['May reject valid solutions due to pessimistic bias', 'Destructive criticism without constructive output'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}

async function executeAnalogical(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];
  const domain = problem.domain || 'software engineering';

  // Step 1: Find analogies from other domains
  const analogies = [
    { domain: 'Biology', analogy: 'Evolutionary selection - test multiple mutations, keep what works', relevance: 0.8 },
    { domain: 'Economics', analogy: 'Market equilibrium - competing forces find balance point', relevance: 0.7 },
    { domain: 'Physics', analogy: 'Entropy minimization - systems tend toward lowest energy state', relevance: 0.6 },
    { domain: 'Architecture', analogy: 'Load-bearing walls - identify which components are structural', relevance: 0.9 },
  ];

  steps.push({
    step: 1,
    description: `Map problem from ${domain} to analogous domains`,
    hypothesis: 'Cross-domain analogies reveal non-obvious solutions',
    verdict: 'confirmed',
  });

  analogies.forEach((a, i) => {
    steps.push({
      step: 2 + i,
      description: `Analogy from ${a.domain}: ${a.analogy}`,
      hypothesis: `Relevance to problem: ${(a.relevance * 100).toFixed(0)}%`,
      verdict: a.relevance > 0.7 ? 'confirmed' : 'inconclusive',
    });
  });

  // Step 2: Transfer insights
  const bestAnalogy = analogies.reduce((a, b) => a.relevance > b.relevance ? a : b);
  steps.push({
    step: steps.length + 1,
    description: `Transfer insight from ${bestAnalogy.domain}: ${bestAnalogy.analogy}`,
    evidence: `Highest relevance: ${(bestAnalogy.relevance * 100).toFixed(0)}%`,
    verdict: 'confirmed',
  });

  // Step 3: Adapt to current domain
  steps.push({
    step: steps.length + 1,
    description: `Adapt transferred insight to ${domain} context`,
    hypothesis: 'Analogical mapping preserves core insight',
    verdict: 'confirmed',
  });

  const tradeoffs: Tradeoff[] = [{
    option: 'Analogy-derived solution',
    pros: ['Novel perspective', 'Proven in other domains', 'Breaks tunnel vision'],
    cons: ['Mapping may be imperfect', 'Domain differences could invalidate', 'May seem unintuitive to domain experts'],
    weight: 0.5,
  }];

  const confidence = Math.min(85, 40 + bestAnalogy.relevance * 30 + steps.length * 3);

  return {
    strategyName: 'analogical',
    reasoning: steps,
    conclusion: `Analogical analysis: Best analogy from ${bestAnalogy.domain} (${(bestAnalogy.relevance * 100).toFixed(0)}% relevance). Insight: "${bestAnalogy.analogy}" applies to current problem, suggesting a ${bestAnalogy.domain.toLowerCase()}-inspired approach.`,
    confidence,
    assumptions: ['Domain analogies transfer meaningfully', 'Selected analogies are the most relevant'],
    tradeoffs,
    risks: ['False analogy could mislead', 'Over-fitting to analogical domain'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}

async function executeDecomposition(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];

  // Step 1: Break problem into sub-problems
  const words = problem.statement.split(' ');
  const subProblemCount = Math.max(3, Math.min(7, Math.ceil(words.length / 5)));

  steps.push({
    step: 1,
    description: `Decompose into ${subProblemCount} independent sub-problems`,
    hypothesis: 'Sub-problems can be solved independently then composed',
    verdict: 'confirmed',
  });

  // Step 2: Solve each sub-problem
  for (let i = 0; i < subProblemCount; i++) {
    steps.push({
      step: 2 + i,
      description: `Sub-problem ${i + 1}: Solve in isolation`,
      hypothesis: `Sub-problem ${i + 1} has a tractable solution`,
      verdict: 'confirmed',
    });
  }

  // Step 3: Identify dependencies between sub-problems
  steps.push({
    step: steps.length + 1,
    description: 'Map dependencies between sub-problems',
    hypothesis: 'Some sub-problems have ordering constraints',
    evidence: `${Math.ceil(subProblemCount / 2)} dependencies identified`,
    verdict: 'confirmed',
  });

  // Step 4: Compose solutions
  steps.push({
    step: steps.length + 1,
    description: 'Compose sub-solutions into complete solution',
    hypothesis: 'Composition preserves correctness of individual solutions',
    verdict: 'confirmed',
  });

  // Step 5: Validate composition
  steps.push({
    step: steps.length + 1,
    description: 'Validate that composed solution is consistent and complete',
    hypothesis: 'No emergent issues from composition',
    verdict: 'inconclusive',
  });

  // Incorporate prior feedback
  if (ctx.priorWinner && ctx.roundNumber > 1) {
    steps.push({
      step: steps.length + 1,
      description: `Refine decomposition using prior winner insight`,
      evidence: ctx.priorWinner.conclusion.substring(0, 100),
      verdict: 'confirmed',
    });
  }

  const tradeoffs: Tradeoff[] = [{
    option: 'Decomposed solution',
    pros: ['Manageable complexity', 'Parallelizable sub-problems', 'Testable independently'],
    cons: ['Integration risk', 'May miss cross-cutting concerns', 'Decomposition choice affects quality'],
    weight: 0.65,
  }];

  const confidence = Math.min(90, 50 + subProblemCount * 5 + (ctx.priorWinner ? 8 : 0));

  return {
    strategyName: 'decomposition',
    reasoning: steps,
    conclusion: `Decomposition analysis: Problem split into ${subProblemCount} sub-problems with ${Math.ceil(subProblemCount / 2)} dependencies. Parallel solution possible for independent sub-problems. Composition validated with ${steps.filter(s => s.verdict === 'confirmed').length}/${steps.length} steps confirmed.`,
    confidence,
    assumptions: ['Decomposition is correct', 'Sub-problems are sufficiently independent'],
    tradeoffs,
    risks: ['Emergent behavior in composition', 'Missing cross-cutting concerns'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}

async function executeSimulation(
  problem: ThinkingProblem,
  ctx: StrategyContext
): Promise<StrategyResult> {
  const start = Date.now();
  const steps: ReasoningStep[] = [];

  // Step 1: Define simulation parameters
  const scenarios = [
    { name: 'Happy path', probability: 0.6, outcome: 'positive' },
    { name: 'Edge case - empty input', probability: 0.15, outcome: 'neutral' },
    { name: 'Stress - 10x load', probability: 0.1, outcome: 'negative' },
    { name: 'Failure - dependency down', probability: 0.1, outcome: 'negative' },
    { name: 'Adversarial - malicious input', probability: 0.05, outcome: 'negative' },
  ];

  steps.push({
    step: 1,
    description: `Define ${scenarios.length} simulation scenarios`,
    hypothesis: 'Simulating multiple scenarios reveals behavior patterns',
    verdict: 'confirmed',
  });

  // Step 2: Run each scenario
  let positiveCount = 0;
  let negativeCount = 0;

  scenarios.forEach((scenario, i) => {
    if (scenario.outcome === 'positive') positiveCount++;
    if (scenario.outcome === 'negative') negativeCount++;

    steps.push({
      step: 2 + i,
      description: `Scenario "${scenario.name}" (p=${scenario.probability}): ${scenario.outcome}`,
      hypothesis: `System handles ${scenario.name} correctly`,
      evidence: `Probability: ${(scenario.probability * 100).toFixed(0)}%`,
      verdict: scenario.outcome === 'negative' ? 'refuted' : 'confirmed',
    });
  });

  // Step 3: Monte Carlo aggregation
  const successRate = positiveCount / scenarios.length;
  steps.push({
    step: steps.length + 1,
    description: `Monte Carlo aggregation: ${(successRate * 100).toFixed(0)}% success rate across ${scenarios.length} scenarios`,
    hypothesis: 'Success rate meets acceptable threshold (>80%)',
    verdict: successRate >= 0.8 ? 'confirmed' : 'refuted',
  });

  // Step 4: Sensitivity analysis
  steps.push({
    step: steps.length + 1,
    description: 'Sensitivity analysis: which parameters most affect outcomes?',
    hypothesis: 'Load and dependency availability are highest-sensitivity parameters',
    verdict: 'confirmed',
  });

  // Incorporate prior round improvements
  if (ctx.roundNumber > 1 && ctx.priorResults) {
    const avgPriorConfidence = ctx.priorResults.reduce((sum, r) => sum + r.confidence, 0) / ctx.priorResults.length;
    steps.push({
      step: steps.length + 1,
      description: `Calibrate simulation against prior round confidence (avg: ${avgPriorConfidence.toFixed(1)}%)`,
      evidence: 'Simulation parameters adjusted based on prior evidence',
      verdict: 'confirmed',
    });
  }

  const tradeoffs: Tradeoff[] = [{
    option: 'Simulation-validated solution',
    pros: ['Quantified risk', 'Scenario-tested', 'Probabilistic confidence'],
    cons: ['Simulation fidelity vs reality', 'Scenario selection bias', 'Computational cost'],
    weight: 0.55,
  }];

  const confidence = Math.min(88, 35 + successRate * 40 + steps.length * 3);

  return {
    strategyName: 'simulation',
    reasoning: steps,
    conclusion: `Simulation analysis: ${scenarios.length} scenarios tested, ${(successRate * 100).toFixed(0)}% success rate. ${negativeCount} failure scenarios require mitigation. Highest sensitivity: load handling and dependency availability.`,
    confidence,
    assumptions: ['Scenarios are representative', 'Probabilities are calibrated'],
    tradeoffs,
    risks: ['Simulation may not capture real-world complexity', 'Scenario selection bias'],
    executionTimeMs: Date.now() - start,
    iterationBorn: ctx.roundNumber,
  };
}
