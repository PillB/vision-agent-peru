/**
 * Agentic Response Engine — redesign of the agent loop with explicit
 * validation, approval, and outcome-verification stages.
 *
 * The old `decide()` (in agent.ts) returns a one-shot decision: rule fires
 * → actions pushed. The new `agenticResponse()` splits this into 9 stages:
 *
 *   1. OBSERVE           — gather raw observations (detections, stats, ctx)
 *   2. VALIDATE_EVIDENCE — check that the observations are not garbage
 *                          (NaN scores, empty bboxes, tainted canvas)
 *   3. POLICY            — apply deterministic rules (useCase.ruleType)
 *   4. JUDGE (optional)  — VLM judge for false-positive filtering
 *   5. VALIDATE_JUDGE    — sanity-check the judge's verdict (refuse if
 *                          confidence < threshold or verdict malformed)
 *   6. PROPOSE_ACTION    — list actions to take, with rationale
 *   7. APPROVAL          — human-in-the-loop gate (auto-approve at low
 *                          tiers, require manual approval at Tier 3)
 *   8. EXECUTE           — run the approved actions
 *   9. VERIFY_OUTCOME    — check whether the situation resolved,
 *                          retry, or compensate (e.g., alert still firing
 *                          after Tier 3 → escalate further)
 *
 * The engine returns a structured `AgenticTrace` so the UI can show
 * the operator exactly what happened at each stage. This is critical
 * for trust — operators must be able to audit WHY an action was taken.
 */

import type { AnomalyStats } from './anomaly'
import type { UseCase, CapabilityLevel } from './use-cases'
import type { Action, ActionName, Tier, AgentConfig } from './agent'
import { DEFAULT_AGENT_CONFIG } from './agent'

export type StageName =
  | 'OBSERVE'
  | 'VALIDATE_EVIDENCE'
  | 'POLICY'
  | 'JUDGE'
  | 'VALIDATE_JUDGE'
  | 'PROPOSE_ACTION'
  | 'APPROVAL'
  | 'EXECUTE'
  | 'VERIFY_OUTCOME'

export interface StageTrace {
  stage: StageName
  status: 'pass' | 'fail' | 'skip' | 'pending'
  timestamp: number
  detail: string
  /** Verdict or decision produced by this stage, if any. */
  result?: Record<string, unknown>
}

export interface AgenticObservation {
  cameraId: string
  cameraLabel: string
  useCase: UseCase
  capabilityLevel: CapabilityLevel
  stats: AnomalyStats
  detections: Array<{ bbox: [number, number, number, number]; class: string; score: number }>
  canvasW: number
  canvasH: number
  sustainCount: number
  escalationHistory: number[]
  acknowledgedUntil: number
  llmJudgeEnabled: boolean
  snapshotDataUrl?: string
}

export interface AgenticResponse {
  tier: Tier
  actions: Action[]
  reasoning: string
  sustainCount: number
  /** Per-stage audit trail — the UI shows this so operators can see WHY. */
  trace: StageTrace[]
  /** Final outcome of the EXECUTE+VERIFY stages (if reached). */
  outcome?: 'resolved' | 'retry' | 'compensate' | 'pending_approval' | 'suppressed'
}

/**
 * Run the 9-stage agentic response loop.
 *
 * This function is PURE — it does NOT execute side-effects. It returns the
 * proposed actions and a trace. The React layer (`useAgentActions`) reads
 * the response and executes the actions, optionally gating on human
 * approval (Tier 3).
 */
export function agenticResponse(
  obs: AgenticObservation,
  config: AgentConfig = DEFAULT_AGENT_CONFIG,
): AgenticResponse {
  const trace: StageTrace[] = []
  const now = Date.now()
  let tier: Tier = 0
  const actions: Action[] = []
  let reasoning = ''

  // ─── Stage 1: OBSERVE ───
  trace.push({
    stage: 'OBSERVE',
    status: 'pass',
    timestamp: now,
    detail: `camera=${obs.cameraId} useCase=${obs.useCase.id} level=${obs.capabilityLevel} count=${obs.detections.length} sustain=${obs.sustainCount} peakZ=${obs.stats.peakZ.toFixed(2)}`,
  })

  // ─── Stage 2: VALIDATE_EVIDENCE ───
  // Reject observations that are clearly garbage — prevents the agent from
  // acting on NaN/Infinity/empty data.
  const validationIssues: string[] = []
  if (!Number.isFinite(obs.stats.count)) validationIssues.push('stats.count is NaN/Infinity')
  if (!Number.isFinite(obs.stats.peakZ)) validationIssues.push('stats.peakZ is NaN/Infinity')
  if (!Number.isFinite(obs.stats.zScore)) validationIssues.push('stats.zScore is NaN/Infinity')
  for (const d of obs.detections) {
    if (!Number.isFinite(d.score) || d.score < 0 || d.score > 1) {
      validationIssues.push(`detection ${d.class} has invalid score ${d.score}`)
      break
    }
    if (d.bbox.some(v => !Number.isFinite(v) || v < 0)) {
      validationIssues.push(`detection ${d.class} has invalid bbox`)
      break
    }
  }
  if (validationIssues.length > 0) {
    trace.push({
      stage: 'VALIDATE_EVIDENCE',
      status: 'fail',
      timestamp: now,
      detail: `Evidence validation failed: ${validationIssues.join('; ')}. Aborting agent loop.`,
    })
    return {
      tier: 0,
      actions: [],
      reasoning: `Evidence validation failed — no action taken. Issues: ${validationIssues.join('; ')}`,
      sustainCount: obs.sustainCount,
      trace,
      outcome: 'suppressed',
    }
  }
  trace.push({
    stage: 'VALIDATE_EVIDENCE',
    status: 'pass',
    timestamp: now,
    detail: `All ${obs.detections.length} detection(s) have finite bbox + score. Stats valid.`,
  })

  // ─── Stage 3: POLICY (deterministic rules) ───
  // Delegates to the existing rule evaluation logic (mirrors agent.ts).
  const allowedActions = new Set(obs.useCase.actions)
  const allTrackedClasses = [...obs.useCase.detectionClasses]
  if (obs.useCase.specializedClassName) allTrackedClasses.push(obs.useCase.specializedClassName)
  const trackedDetections = obs.detections.filter(d => allTrackedClasses.includes(d.class))
  const trackedCount = trackedDetections.length

  let ruleTriggered = false
  let ruleReason = ''
  switch (obs.useCase.ruleType) {
    case 'roi_breach': {
      const roi = obs.useCase.params.roiPolygon
      if (roi && roi.length >= 3 && obs.canvasW > 0 && obs.canvasH > 0) {
        const breachCount = trackedDetections.filter(d => {
          const cx = (d.bbox[0] + d.bbox[2] / 2) / obs.canvasW
          const cy = (d.bbox[1] + d.bbox[3] / 2) / obs.canvasH
          return pointInPolygon(cx, cy, roi)
        }).length
        if (breachCount > 0) {
          ruleTriggered = true
          ruleReason = `ROI breach: ${breachCount} ${obs.useCase.detectionClasses.join('/')} in restricted zone`
        }
      }
      break
    }
    case 'time_gate': {
      const gate = obs.useCase.params.timeGate
      if (gate) {
        const hour = new Date().getHours()
        const after = parseInt(gate.after.split(':')[0])
        const before = parseInt(gate.before.split(':')[0])
        const inWindow = after > before
          ? (hour >= after || hour < before)
          : (hour >= after && hour < before)
        if (inWindow && trackedCount >= (obs.useCase.params.threshold || 1)) {
          ruleTriggered = true
          ruleReason = `Time gate: ${trackedCount} detections after hours (${gate.after}-${gate.before})`
        }
      }
      break
    }
    case 'count_threshold': {
      const thresh = obs.useCase.params.threshold ?? 0
      if (trackedCount >= thresh) {
        ruleTriggered = true
        ruleReason = `Count threshold: ${trackedCount} >= ${thresh}`
      }
      break
    }
    case 'density_anomaly': {
      const threshold = obs.useCase.params.threshold || config.t1Z
      if (obs.stats.peakZ > threshold) {
        ruleTriggered = true
        ruleReason = `Density anomaly: peakZ=${obs.stats.peakZ.toFixed(2)} > ${threshold}`
      }
      break
    }
    case 'sustain_verify': {
      const sustainNeeded = obs.useCase.params.sustainTicks || 3
      if (trackedCount >= (obs.useCase.params.threshold || 1) && obs.sustainCount >= sustainNeeded) {
        ruleTriggered = true
        ruleReason = `Sustain verify: ${trackedCount} detections sustained for ${obs.sustainCount} ticks`
      }
      break
    }
    case 'frame_diff': {
      if (trackedCount > 0) {
        ruleTriggered = true
        ruleReason = `Pixel-anomaly/specialized model detected ${trackedCount} object(s)`
      } else if (obs.stats.peakZ > config.t1Z) {
        ruleTriggered = true
        ruleReason = `Detection-count anomaly: peakZ=${obs.stats.peakZ.toFixed(2)}`
      }
      break
    }
  }

  trace.push({
    stage: 'POLICY',
    status: ruleTriggered ? 'pass' : 'skip',
    timestamp: now,
    detail: ruleTriggered
      ? `Rule ${obs.useCase.ruleType} fired: ${ruleReason}`
      : `Rule ${obs.useCase.ruleType} did not fire (count=${trackedCount}, peakZ=${obs.stats.peakZ.toFixed(2)})`,
    result: { ruleTriggered, ruleReason, trackedCount },
  })

  if (!ruleTriggered) {
    return {
      tier: 0,
      actions: [],
      reasoning: `${obs.useCase.nameEn}: no rule fired.`,
      sustainCount: obs.sustainCount,
      trace,
      outcome: 'resolved',
    }
  }

  reasoning = `${obs.useCase.nameEn}: ${ruleReason}`

  // ─── Stage 4: JUDGE (optional, only at cognitive+ with llmJudgeEnabled) ───
  const allowLLM = obs.capabilityLevel === 'cognitive' || obs.capabilityLevel === 'agentic'
  const allowAutoAction = obs.capabilityLevel === 'agentic'
  const allowEscalation = obs.capabilityLevel === 'agentic'

  let judgeVerdict: 'real' | 'false_positive' | undefined
  let judgeConfidence = 0
  let judgeReason = ''

  if (allowLLM && obs.llmJudgeEnabled && allowedActions.has('llm_judge' as ActionName)) {
    // The actual judge call happens in the React layer (useAgentActions)
    // because it needs network + canvas access. Here we just record that
    // the judge stage is REQUESTED. The React layer fills in the result.
    trace.push({
      stage: 'JUDGE',
      status: 'pending',
      timestamp: now,
      detail: 'LLM judge requested — React layer will call /api/judge with snapshot evidence.',
    })
    // Mark that we want a judge call — the React layer reads actions[] and
    // sees 'llm_judge' in the list, then makes the actual HTTP request.
  } else {
    trace.push({
      stage: 'JUDGE',
      status: 'skip',
      timestamp: now,
      detail: 'LLM judge skipped (disabled or capability level too low).',
    })
  }

  // ─── Stage 5: VALIDATE_JUDGE ───
  // If the judge returned a verdict (in a real call this would be awaited,
  // but since this is a sync pure function, we just record the validation
  // rule that the React layer must apply). If the judge has not yet run,
  // this stage records what the validation criteria are.
  if (allowLLM && obs.llmJudgeEnabled && allowedActions.has('llm_judge' as ActionName)) {
    trace.push({
      stage: 'VALIDATE_JUDGE',
      status: 'pending',
      timestamp: now,
      detail: 'Criteria: refuse verdict if confidence < 0.3, refuse malformed JSON, refuse if reason empty. Default to conservative (real) on refusal.',
      result: { minConfidence: 0.3 },
    })
  } else {
    trace.push({
      stage: 'VALIDATE_JUDGE',
      status: 'skip',
      timestamp: now,
      detail: 'No judge verdict to validate.',
    })
  }

  // ─── Stage 6: PROPOSE_ACTION ───
  // Build the proposed action list, filtered by useCase.actions.
  const proposed: Action[] = []
  if (allowedActions.has('badge' as ActionName)) {
    proposed.push({ name: 'badge', tier: 1, reason: ruleReason, timestamp: now })
    tier = 1
  }
  const sustainNeeded = obs.useCase.params.sustainTicks || config.t2Sustain
  const tier2Ready = obs.sustainCount >= sustainNeeded
    && (obs.capabilityLevel === 'mldl' || obs.capabilityLevel === 'cognitive' || obs.capabilityLevel === 'agentic')
  if (tier2Ready) {
    if (allowedActions.has('snapshot' as ActionName)) {
      proposed.push({ name: 'snapshot', tier: 2, reason: ruleReason, timestamp: now })
    }
    if (allowedActions.has('log_hit' as ActionName)) {
      proposed.push({ name: 'log_hit', tier: 2, reason: `${ruleReason} | count=${trackedCount} peakZ=${obs.stats.peakZ.toFixed(2)}`, timestamp: now, payload: { count: trackedCount, peakZ: obs.stats.peakZ, useCase: obs.useCase.id } })
    }
    if (allowedActions.has('send_email' as ActionName) && allowAutoAction) {
      proposed.push({
        name: 'send_email', tier: 2,
        reason: `automated notification for [${obs.useCase.name}]`,
        timestamp: now,
        payload: { to: 'ops@vision-agent.security', subject: `[${obs.cameraId}] ${obs.useCase.name} — ${trackedCount} detections` },
      })
    }
    if (proposed.some(a => a.tier === 2)) tier = 2
  }
  // Tier 3: only at agentic level, with circuit breaker check.
  const recentEscalations = obs.escalationHistory.filter(t => now - t < 3600_000)
  const breakerTripped = recentEscalations.length >= config.maxEscalationsPerHour
  const silenced = now < obs.acknowledgedUntil
  if (allowEscalation && !breakerTripped && !silenced && obs.sustainCount >= config.t3Sustain) {
    if (allowLLM && obs.llmJudgeEnabled && allowedActions.has('llm_judge' as ActionName)) {
      proposed.push({ name: 'llm_judge', tier: 3, reason: `LLM false-positive filter for [${obs.useCase.name}]`, timestamp: now })
    }
    if (allowedActions.has('escalate' as ActionName)) {
      proposed.push({ name: 'escalate', tier: 3, reason: `critical escalation: ${ruleReason}`, timestamp: now })
    }
    if (allowedActions.has('generate_report' as ActionName)) {
      proposed.push({ name: 'generate_report', tier: 3, reason: `auto-generate ${obs.useCase.indeciReport ? 'INDECI ' : ''}incident report`, timestamp: now })
    }
    if (proposed.some(a => a.tier === 3)) tier = 3
  } else if (breakerTripped && allowEscalation) {
    trace.push({
      stage: 'PROPOSE_ACTION',
      status: 'skip',
      timestamp: now,
      detail: `Circuit breaker tripped: ${recentEscalations.length}/${config.maxEscalationsPerHour} escalations this hour.`,
    })
  }

  actions.push(...proposed)
  trace.push({
    stage: 'PROPOSE_ACTION',
    status: proposed.length > 0 ? 'pass' : 'skip',
    timestamp: now,
    detail: `Proposed ${proposed.length} action(s): ${proposed.map(a => a.name).join(', ') || '(none)'}`,
    result: { proposed: proposed.map(a => a.name), tier },
  })

  // ─── Stage 7: APPROVAL ───
  // Tier 3 actions require human approval. Tier 0-2 auto-approve.
  let outcome: AgenticResponse['outcome'] = 'pending_approval'
  if (silenced) {
    trace.push({
      stage: 'APPROVAL',
      status: 'skip',
      timestamp: now,
      detail: 'Silenced by operator — no actions will execute.',
    })
    return {
      tier: 0,
      actions: [],
      reasoning: reasoning + ' | SILENCED by operator',
      sustainCount: obs.sustainCount,
      trace,
      outcome: 'suppressed',
    }
  }
  if (tier >= 3) {
    trace.push({
      stage: 'APPROVAL',
      status: 'pending',
      timestamp: now,
      detail: `Tier 3 escalation requires operator approval before execute. Auto-approve false-positives are still suppressed.`,
    })
    outcome = 'pending_approval'
  } else {
    trace.push({
      stage: 'APPROVAL',
      status: 'pass',
      timestamp: now,
      detail: `Tier ${tier} — auto-approved.`,
    })
    outcome = 'resolved'
  }

  // ─── Stage 8: EXECUTE ───
  // Actual execution happens in the React layer. Record that we've queued
  // the actions for execution.
  trace.push({
    stage: 'EXECUTE',
    status: 'pending',
    timestamp: now,
    detail: `${actions.length} action(s) queued for execution by React layer.`,
  })

  // ─── Stage 9: VERIFY_OUTCOME ───
  // The verify stage is run on the NEXT tick — it checks whether the
  // situation resolved after the actions executed. This is recorded as
  // a pending check; the React layer re-runs this function next tick
  // and the new trace will show whether peakZ has dropped, etc.
  trace.push({
    stage: 'VERIFY_OUTCOME',
    status: 'pending',
    timestamp: now,
    detail: 'Will verify on next tick: if peakZ drops below threshold → resolved; if still elevated after 3 ticks → retry; if still elevated after 6 ticks → compensate (escalate to next tier).',
  })

  return {
    tier,
    actions,
    reasoning,
    sustainCount: obs.sustainCount,
    trace,
    outcome,
  }
}

// ─── helpers ────────────────────────────────────────────────────────

function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}
