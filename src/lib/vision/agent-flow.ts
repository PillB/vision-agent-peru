/**
 * Agent decision flow model — the n8n-style DAG for the 9-stage agentic loop.
 *
 * Layout (cols left→right):
 *   col0: OBSERVE
 *   col1: VALIDATE_EVIDENCE        (branches: pass→POLICY, fail→RETRY→OBSERVE)
 *   col2: POLICY (decision)        (branches: tier0→PROPOSE_ACTION(skip judge),
 *                                   tier1→PROPOSE_ACTION(skip judge),
 *                                   tier2→JUDGE, tier3→JUDGE)
 *   col3: JUDGE                    (branches: pass→VALIDATE_JUDGE, fail→SUPPRESSED)
 *         VALIDATE_JUDGE           (branches: pass→PROPOSE_ACTION, fail→SUPPRESSED)
 *   col4: PROPOSE_ACTION           (branches: low→APPROVAL auto, high→APPROVAL manual)
 *   col5: APPROVAL                 (branches: approve→EXECUTE, reject→SUPPRESSED)
 *   col6: EXECUTE                  (branches: ok→VERIFY_OUTCOME, error→RETRY)
 *   col7: VERIFY_OUTCOME           (branches: resolve→RESOLVED, retry→RETRY, compensate→ESCALATE)
 *   terminals: RETRY (loops back to OBSERVE), SUPPRESSED, ESCALATE, RESOLVED
 */

import type { FlowNode, FlowEdge, StageName, UseCase, Tier, AgentFlowRun, StageTrace, BranchTag } from './types'

export const FLOW_NODES: FlowNode[] = [
  { id: 'observe', stage: 'OBSERVE', label: 'Observe', short: '1', type: 'observe', col: 0, row: 0, icon: 'eye', description: 'Gather raw observations — detections, anomaly stats, ROI state, frame-diff.' },
  { id: 'validate_evidence', stage: 'VALIDATE_EVIDENCE', label: 'Validate Evidence', short: '2', type: 'validate', col: 1, row: 0, icon: 'shield-check', description: 'Reject garbage inputs: NaN scores, empty bboxes, tainted canvas.' },
  { id: 'policy', stage: 'POLICY', label: 'Policy', short: '3', type: 'decision', col: 2, row: 0, icon: 'git-branch', description: 'Apply deterministic use-case rule → compute tier.' },
  { id: 'judge', stage: 'JUDGE', label: 'LLM / VLM Judge', short: '4', type: 'judge', col: 3, row: -1, icon: 'gavel', description: 'Optional VLM judge filters false positives at Tier ≥ 2.' },
  { id: 'validate_judge', stage: 'VALIDATE_JUDGE', label: 'Validate Judge', short: '5', type: 'validate', col: 3, row: 1, icon: 'badge-check', description: 'Sanity-check judge verdict (confidence, format). Refuse if malformed.' },
  { id: 'propose_action', stage: 'PROPOSE_ACTION', label: 'Propose Action', short: '6', type: 'action', col: 4, row: 0, icon: 'clipboard-list', description: 'List actions + rationale for the assigned tier.' },
  { id: 'approval', stage: 'APPROVAL', label: 'Approval Gate', short: '7', type: 'decision', col: 5, row: 0, icon: 'user-check', description: 'Auto-approve ≤ Tier 2; manual approval at Tier 3 (human-in-the-loop).' },
  { id: 'execute', stage: 'EXECUTE', label: 'Execute', short: '8', type: 'action', col: 6, row: 0, icon: 'zap', description: 'Run approved actions: snapshot, email, report, escalate.' },
  { id: 'verify_outcome', stage: 'VERIFY_OUTCOME', label: 'Verify Outcome', short: '9', type: 'verify', col: 7, row: 0, icon: 'circle-check', description: 'Check resolution. Retry / compensate / resolve.' },
  // terminals
  { id: 'resolved', stage: 'RESOLVED', label: 'Resolved', short: '✓', type: 'terminal', col: 8, row: 0, icon: 'check-circle-2', description: 'Situation resolved. Cycle closes.' },
  { id: 'suppressed', stage: 'SUPPRESSED', label: 'Suppressed', short: '⊘', type: 'terminal', col: 4, row: 2, icon: 'ban', description: 'False positive or rejected by judge / approval. No action taken.' },
  { id: 'escalate', stage: 'ESCALATE', label: 'Escalate', short: '↑', type: 'terminal', col: 8, row: 2, icon: 'arrow-up-circle', description: 'Outcome not resolved — escalate to human / next tier.' },
  { id: 'retry', stage: 'RETRY', label: 'Retry Cycle', short: '↻', type: 'terminal', col: 0, row: 2, icon: 'rotate-cw', description: 'Re-observe on validation failure or execution error.' },
]

export const FLOW_EDGES: FlowEdge[] = [
  { source: 'observe', target: 'validate_evidence', branch: 'pass', label: 'obs ok', weight: 0.95 },
  { source: 'validate_evidence', target: 'policy', branch: 'pass', label: 'valid', weight: 0.9 },
  { source: 'validate_evidence', target: 'retry', branch: 'fail', label: 'garbage', weight: 0.1 },
  { source: 'policy', target: 'propose_action', branch: 'tier0', label: 'T0', weight: 0.45 },
  { source: 'policy', target: 'propose_action', branch: 'tier1', label: 'T1', weight: 0.25 },
  { source: 'policy', target: 'judge', branch: 'tier2', label: 'T2', weight: 0.2 },
  { source: 'policy', target: 'judge', branch: 'tier3', label: 'T3', weight: 0.1 },
  { source: 'judge', target: 'validate_judge', branch: 'pass', label: 'real', weight: 0.7 },
  { source: 'judge', target: 'suppressed', branch: 'fail', label: 'FP', weight: 0.3 },
  { source: 'validate_judge', target: 'propose_action', branch: 'pass', label: 'ok', weight: 0.9 },
  { source: 'validate_judge', target: 'suppressed', branch: 'fail', label: 'malformed', weight: 0.1 },
  { source: 'propose_action', target: 'approval', branch: 'approve', label: 'actions', weight: 1.0 },
  { source: 'approval', target: 'execute', branch: 'approve', label: 'auto', weight: 0.85 },
  { source: 'approval', target: 'suppressed', branch: 'reject', label: 'manual reject', weight: 0.15 },
  { source: 'execute', target: 'verify_outcome', branch: 'pass', label: 'ran', weight: 0.92 },
  { source: 'execute', target: 'retry', branch: 'fail', label: 'error', weight: 0.08 },
  { source: 'verify_outcome', target: 'resolved', branch: 'resolve', label: 'ok', weight: 0.65 },
  { source: 'verify_outcome', target: 'retry', branch: 'retry', label: 'retry', weight: 0.2 },
  { source: 'verify_outcome', target: 'escalate', branch: 'compensate', label: 'compensate', weight: 0.15 },
]

export const NODE_BY_ID = Object.fromEntries(FLOW_NODES.map((n) => [n.id, n])) as Record<string, FlowNode>

export const STAGE_ORDER: StageName[] = [
  'OBSERVE',
  'VALIDATE_EVIDENCE',
  'POLICY',
  'JUDGE',
  'VALIDATE_JUDGE',
  'PROPOSE_ACTION',
  'APPROVAL',
  'EXECUTE',
  'VERIFY_OUTCOME',
]

export const BRANCH_COLORS: Record<BranchTag, string> = {
  pass: '#10b981',
  fail: '#ef4444',
  tier0: '#10b981',
  tier1: '#f59e0b',
  tier2: '#f97316',
  tier3: '#ef4444',
  approve: '#10b981',
  reject: '#ef4444',
  retry: '#f59e0b',
  suppressed: '#64748b',
  resolve: '#10b981',
  compensate: '#ef4444',
}

// ─── Per-use-case trace generator ───────────────────────────────────────────
// Deterministic "run" of the 9-stage loop for a given use case + cycle seed.
// Produces a realistic branch path and per-stage reasoning, so the dashboard
// can animate the flow lighting up along the actual decision path.

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRand(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ruleReasoning(uc: UseCase): string {
  switch (uc.ruleType) {
    case 'roi_breach':
      return `ROI breach: subject entered restricted polygon (${uc.signal}).`
    case 'time_gate':
      return `Time gate: vehicle within 20:00–06:00 window (${uc.signal}).`
    case 'density_anomaly':
      return `z-score of ${uc.detectionClasses[0]} count exceeds ${uc.params.threshold} sustained ${uc.params.sustainTicks} cycles (${uc.signal}).`
    case 'sustain_verify':
      return `Sustain verify: ${uc.detectionClasses.join('/')} present ${uc.params.sustainTicks} cycles (${uc.signal}).`
    case 'frame_diff':
      return `Frame-diff ${uc.params.threshold} sustained ${uc.params.sustainTicks} cycles (${uc.signal}).`
    case 'count_threshold':
      return `Count threshold: ${uc.detectionClasses.join('/')} count crossed ${uc.params.threshold} (${uc.signal}).`
  }
}

export function generateAgentRun(uc: UseCase, cycle: number): AgentFlowRun {
  const rnd = seededRand(hashSeed(uc.id + ':' + cycle))
  const now = Date.now() - 9 * 1000
  const trace: StageTrace[] = []
  let t = now

  const push = (stage: StageName, status: StageTrace['status'], reasoning: string, detail: string, extra?: Partial<StageTrace>) => {
    trace.push({ stage, status, reasoning, detail, timestamp: t, ...extra })
    t += 1000
  }

  // Stage 1: OBSERVE
  push(
    'OBSERVE',
    'pass',
    `Perceiving feed for "${uc.nameEn}" — ${uc.detectionClasses.length} detector classes active.`,
    `${uc.detectionClasses.join(', ')} · ${uc.ruleType} rule`,
  )

  // Stage 2: VALIDATE_EVIDENCE (small chance of garbage → retry)
  const evidenceClean = rnd() > 0.12
  if (!evidenceClean) {
    push('VALIDATE_EVIDENCE', 'fail', 'Tainted canvas / NaN score detected — discarding observation.', 'NaN bbox score, retry cycle', { branch: 'fail' })
    return finishRun(uc, cycle, trace, 0, 'retry', ['log_tick'])
  }
  push('VALIDATE_EVIDENCE', 'pass', 'Observations are clean: valid bboxes, finite scores, untainted canvas.', 'all checks pass', { branch: 'pass' })

  // Stage 3: POLICY → tier decision
  const tier = uc.tier
  const z = tier === 3 ? 3.9 : tier === 2 ? 2.8 : tier === 1 ? 2.1 : 0.6
  push(
    'POLICY',
    'pass',
    `${ruleReasoning(uc)} → Tier ${tier} (${z.toFixed(1)}σ).`,
    `z=${z.toFixed(2)} · tier=${tier}`,
    { tier, branch: (`tier${tier}` as BranchTag) },
  )

  // Stages 4-5: JUDGE + VALIDATE_JUDGE (only tier >= 2 with cognitive/agentic)
  const needsJudge = tier >= 2 && (uc.level === 'cognitive' || uc.level === 'agentic')
  if (!needsJudge) {
    push('JUDGE', 'skip', 'LLM judge skipped — rule-based decision sufficient at this capability level.', 'no judge for ' + uc.level)
    push('VALIDATE_JUDGE', 'skip', '—', '—')
  } else {
    const judgeReal = rnd() > 0.25
    if (!judgeReal) {
      push('JUDGE', 'fail', `VLM judge classified the signal as a false positive (conf ${(0.3 + rnd() * 0.2).toFixed(2)}).`, 'verdict=FP', { branch: 'fail' })
      return finishRun(uc, cycle, trace, tier, 'suppressed', ['log_hit'])
    }
    push('JUDGE', 'pass', `VLM judge confirms real anomaly (conf ${(0.78 + rnd() * 0.18).toFixed(2)}). Verdict: confirmed.`, 'verdict=real', { branch: 'pass' })
    const judgeValid = rnd() > 0.08
    if (!judgeValid) {
      push('VALIDATE_JUDGE', 'fail', 'Judge verdict malformed / confidence below threshold — refusing to act.', 'malformed verdict', { branch: 'fail' })
      return finishRun(uc, cycle, trace, tier, 'suppressed', ['log_hit'])
    }
    push('VALIDATE_JUDGE', 'pass', 'Judge verdict well-formed and above confidence threshold.', 'confidence ok', { branch: 'pass' })
  }

  // Stage 6: PROPOSE_ACTION
  push('PROPOSE_ACTION', 'pass', `Proposing ${uc.actions.length} actions for Tier ${tier}: ${uc.actions.join(', ')}.`, uc.actions.join(', '))

  // Stage 7: APPROVAL (tier 3 → manual)
  if (tier >= 3) {
    const approved = rnd() > 0.18
    if (!approved) {
      push('APPROVAL', 'fail', 'Manual approval gate: operator deferred Tier 3 action. Suppressed this cycle.', 'manual reject', { branch: 'reject' })
      return finishRun(uc, cycle, trace, tier, 'suppressed', ['log_hit'])
    }
    push('APPROVAL', 'pass', 'Manual approval granted by operator for Tier 3 action.', 'approved', { branch: 'approve' })
  } else {
    push('APPROVAL', 'pass', `Auto-approved at Tier ${tier} (no manual gate required).`, 'auto-approve', { branch: 'approve' })
  }

  // Stage 8: EXECUTE
  const execOk = rnd() > 0.08
  if (!execOk) {
    push('EXECUTE', 'fail', 'Execution error (snapshot queue full / network blip). Retrying cycle.', 'exec error', { branch: 'fail' })
    return finishRun(uc, cycle, trace, tier, 'retry', uc.actions.slice(0, 1))
  }
  push('EXECUTE', 'pass', `Executed: ${uc.actions.join(', ')}.`, uc.actions.join(', '), { action: uc.actions[0] })

  // Stage 9: VERIFY_OUTCOME
  const roll = rnd()
  if (roll < 0.65) {
    push('VERIFY_OUTCOME', 'pass', 'Situation resolved — anomaly cleared within observation window.', 'resolved', { branch: 'resolve' })
    return finishRun(uc, cycle, trace, tier, 'resolved', uc.actions)
  } else if (roll < 0.85) {
    push('VERIFY_OUTCOME', 'pass', 'Anomaly persists — retrying observation cycle.', 'retry', { branch: 'retry' })
    return finishRun(uc, cycle, trace, tier, 'retry', uc.actions)
  } else {
    push('VERIFY_OUTCOME', 'pass', 'Outcome uncertain — escalating to human supervisor.', 'compensate', { branch: 'compensate' })
    return finishRun(uc, cycle, trace, tier, 'compensate', [...uc.actions, 'escalate'])
  }
}

function finishRun(
  uc: UseCase,
  cycle: number,
  trace: StageTrace[],
  tier: Tier,
  outcome: AgentFlowRun['finalOutcome'],
  actions: string[],
): AgentFlowRun {
  return {
    useCaseId: uc.id,
    useCaseName: uc.name,
    cycle,
    startedAt: Date.now(),
    trace,
    finalTier: tier,
    finalOutcome: outcome,
    finalActions: actions,
  }
}

// Compute the set of node ids + edges that are "on the path" for a given run.
export function computeActivePath(run: AgentFlowRun): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>()
  const edges = new Set<string>()
  // Start at observe
  nodes.add('observe')
  let cursor = 'observe'

  const stepTo = (target: string, branch: BranchTag) => {
    nodes.add(target)
    edges.add(`${cursor}->${target}:${branch}`)
    cursor = target
  }

  for (const t of run.trace) {
    if (t.branch) {
      // figure out target from edges
      const edge = FLOW_EDGES.find((e) => e.source === cursor && e.branch === t.branch)
      if (edge) stepTo(edge.target, edge.branch)
    }
  }
  return { nodes, edges }
}
