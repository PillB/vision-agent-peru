/**
 * Agentic decision engine — consumes anomaly stats + context + active use case
 * and decides actions.
 *
 * Architecture mirrors the research synthesis (Task 0-b):
 *   - Rule registry (data, not code) → easy to extend
 *   - 3-tier escalation: Tier 1 (badge) → Tier 2 (snapshot + email sim) → Tier 3 (LLM judge + escalation)
 *   - Sustain counter: anomaly must persist N ticks before escalating
 *   - LLM-as-judge: optional server call to filter false positives at Tier ≥ 3
 *   - Acknowledge/Silence: human-in-the-loop circuit breaker
 *   - Use-case-aware: the active use case determines which rule type, threshold,
 *     and actions are applied (ROI breach, time gate, density anomaly, etc.)
 *   - Capability-level-aware: traditional = rules only, mldl = +detection/scoring,
 *     cognitive = +LLM description, agentic = +autonomous action + LLM judge
 *
 * SEPARATION OF CONCERNS — the agent layer is distinct from the analytics layer:
 *   - Analytics layer (anomaly.ts): pure math on detection counts
 *   - Agentic layer (this file): reasoning + action dispatch
 */

import type { AnomalyStats } from './anomaly'
import type { UseCase, CapabilityLevel } from './use-cases'

export type Tier = 0 | 1 | 2 | 3

export type ActionName =
  | 'log_tick'
  | 'badge'
  | 'snapshot'
  | 'log_hit'
  | 'send_email'
  | 'generate_report'
  | 'escalate'
  | 'llm_judge'
  | 'acknowledge'
  | 'silence'

export interface Action {
  name: ActionName
  tier: Tier
  reason: string
  timestamp: number
  payload?: Record<string, unknown>
}

export interface AgentDecision {
  tier: Tier
  actions: Action[]
  reasoning: string
  sustainCount: number
}

export interface AgentConfig {
  // Tier 1: badge when z > threshold
  t1Z: number
  // Tier 2: snapshot + email sim when z > t2Z sustained for t2Sustain ticks
  t2Z: number
  t2Sustain: number
  // Tier 3: LLM judge + escalate when z > t3Z sustained for t3Sustain ticks
  t3Z: number
  t3Sustain: number
  // Max escalations per hour (circuit breaker)
  maxEscalationsPerHour: number
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  t1Z: 2,
  t2Z: 2.5,
  t2Sustain: 3,
  t3Z: 3.5,
  t3Sustain: 3,
  maxEscalationsPerHour: 5,
}

export interface AgentContext {
  stats: AnomalyStats
  cameraId: string
  cameraLabel: string
  sustainCount: number
  escalationHistory: number[]   // epoch ms of past escalations
  acknowledgedUntil: number     // silence until (epoch ms)
  llmJudgeEnabled: boolean
  /** Active use case — determines rule type, threshold, and actions. */
  useCase: UseCase
  /** Active capability level — gates which features are enabled. */
  capabilityLevel: CapabilityLevel
  /** Current detections (for ROI breach checks). */
  detections: Array<{ bbox: [number, number, number, number]; class: string; score: number }>
  /** Canvas dimensions (for ROI normalization). */
  canvasW: number
  canvasH: number
}

/**
 * The agent's perceive→reason→act loop.
 *
 * USE-CASE-AWARE: The active use case determines which rule type is applied:
 *   - density_anomaly: z-score/peakZ thresholds (current logic)
 *   - roi_breach: check if any detection centroid is inside ROI polygon
 *   - time_gate: check if current time is within gated window
 *   - count_threshold: check if count exceeds threshold
 *   - sustain_verify: check if detection sustained for N ticks
 *   - frame_diff: uses z-score as proxy for pixel-change anomaly (full frame-diff would compare canvas ImageData buffers)
 *
 * CAPABILITY-LEVEL-AWARE: The level gates which features are enabled:
 *   - traditional: rules only (ROI breach, time gate, count threshold). No z-score, no LLM, no auto-report.
 *   - mldl: + detection, z-score, density anomaly. No LLM judge, no auto-report.
 *   - cognitive: + LLM description. No autonomous actions (no escalate, no auto-report).
 *   - agentic: full loop with LLM judge, auto-report, escalation.
 *
 * Pure function — given context, returns the decision (tier + actions + reasoning).
 */
export function decide(ctx: AgentContext, config: AgentConfig = DEFAULT_AGENT_CONFIG): AgentDecision {
  const { stats, sustainCount, escalationHistory, acknowledgedUntil, useCase, capabilityLevel, detections, canvasW, canvasH } = ctx
  const now = Date.now()
  const silenced = now < acknowledgedUntil

  // Recent escalation count (last hour) — circuit breaker
  const recentEscalations = escalationHistory.filter((t) => now - t < 3600_000)
  const breakerTripped = recentEscalations.length >= config.maxEscalationsPerHour

  const actions: Action[] = []
  let tier: Tier = 0

  // Count detections matching the use case's tracked classes
  const trackedDetections = detections.filter((d) => useCase.detectionClasses.includes(d.class))
  const trackedCount = trackedDetections.length

  // Always log the tick (low-cost telemetry)
  actions.push({
    name: 'log_tick',
    tier: 0,
    reason: `useCase=${useCase.id} level=${capabilityLevel} count=${trackedCount} z=${stats.zScore.toFixed(2)} peakZ=${stats.peakZ.toFixed(2)} | EMA=${stats.ema.toFixed(1)} | sustain=${sustainCount}`,
    timestamp: now,
  })

  let reasoning = `[${useCase.name}] L${capabilityLevel} | count=${trackedCount} z=${stats.zScore.toFixed(2)} peakZ=${stats.peakZ.toFixed(2)} | sustain=${sustainCount}`

  if (silenced) {
    return {
      tier: 0,
      actions,
      reasoning: reasoning + ' | SILENCED by operator',
      sustainCount,
    }
  }

  // ===== RULE EVALUATION (use-case-aware) =====
  let ruleTriggered = false
  let ruleReason = ''

  switch (useCase.ruleType) {
    case 'roi_breach': {
      // Check if any tracked detection's centroid is inside the ROI polygon
      const roi = useCase.params.roiPolygon
      if (roi && roi.length >= 3 && canvasW > 0 && canvasH > 0) {
        const breachCount = trackedDetections.filter((d) => {
          const cx = (d.bbox[0] + d.bbox[2] / 2) / canvasW
          const cy = (d.bbox[1] + d.bbox[3] / 2) / canvasH
          return pointInPolygon(cx, cy, roi)
        }).length
        if (breachCount > 0) {
          ruleTriggered = true
          ruleReason = `ROI breach: ${breachCount} ${useCase.detectionClasses.join('/')} in restricted zone`
        }
      }
      break
    }

    case 'time_gate': {
      // Check if current time is within the gated window
      const gate = useCase.params.timeGate
      if (gate) {
        const hour = new Date().getHours()
        const afterHour = parseInt(gate.after.split(':')[0])
        const beforeHour = parseInt(gate.before.split(':')[0])
        const inWindow = afterHour > beforeHour
          ? (hour >= afterHour || hour < beforeHour)
          : (hour >= afterHour && hour < beforeHour)
        if (inWindow && trackedCount >= (useCase.params.threshold || 1)) {
          ruleTriggered = true
          ruleReason = `Time gate: ${trackedCount} ${useCase.detectionClasses.join('/')} detected after hours (${gate.after}-${gate.before})`
        }
      }
      break
    }

    case 'count_threshold': {
      if (trackedCount >= (useCase.params.threshold || 0)) {
        ruleTriggered = true
        ruleReason = `Count threshold: ${trackedCount} >= ${useCase.params.threshold}`
      }
      break
    }

    case 'density_anomaly': {
      // Use z-score/peakZ — the existing statistical logic
      const threshold = useCase.params.threshold || config.t1Z
      if (stats.peakZ > threshold) {
        ruleTriggered = true
        ruleReason = `Density anomaly: peakZ=${stats.peakZ.toFixed(2)} > ${threshold}`
      }
      break
    }

    case 'sustain_verify': {
      // Check if detection is sustained for N ticks
      const sustainNeeded = useCase.params.sustainTicks || 3
      if (trackedCount >= (useCase.params.threshold || 1) && sustainCount >= sustainNeeded) {
        ruleTriggered = true
        ruleReason = `Sustain verify: ${trackedCount} detections sustained for ${sustainCount} ticks`
      }
      break
    }

    case 'frame_diff': {
      // Frame-differencing logic — would compare current frame to baseline.
      // For now, use z-score as a proxy (pixel-change anomaly registers as count anomaly).
      // Full frame-diff implementation would compare canvas ImageData buffers.
      const threshold = useCase.params.frameDiffThreshold || 0.15
      if (stats.peakZ > config.t1Z) {
        ruleTriggered = true
        ruleReason = `Frame-diff anomaly: peakZ=${stats.peakZ.toFixed(2)} (proxy for pixel change > ${threshold})`
      }
      break
    }
  }

  // ===== CAPABILITY LEVEL GATING =====
  // Determine which actions are allowed at this capability level
  const allowLLM = capabilityLevel === 'cognitive' || capabilityLevel === 'agentic'
  const allowAutoAction = capabilityLevel === 'agentic'
  const allowEscalation = capabilityLevel === 'agentic'

  // ===== TIER ESCALATION =====
  if (ruleTriggered) {
    // Tier 1: badge (always allowed)
    tier = 1
    actions.push({
      name: 'badge',
      tier: 1,
      reason: ruleReason,
      timestamp: now,
    })
    reasoning += ` | T1: ${ruleReason}`

    // Tier 2: snapshot + email + log (allowed at mldl+ and agentic)
    const sustainNeeded = useCase.params.sustainTicks || config.t2Sustain
    if (sustainCount >= sustainNeeded && (capabilityLevel === 'mldl' || capabilityLevel === 'cognitive' || capabilityLevel === 'agentic')) {
      tier = 2
      actions.push({ name: 'snapshot', tier: 2, reason: ruleReason, timestamp: now })
      actions.push({ name: 'log_hit', tier: 2, reason: `${ruleReason} | count=${trackedCount} peakZ=${stats.peakZ.toFixed(2)}`, timestamp: now, payload: { count: trackedCount, peakZ: stats.peakZ, useCase: useCase.id } })

      if (allowAutoAction) {
        actions.push({
          name: 'send_email',
          tier: 2,
          reason: `automated notification for [${useCase.name}]`,
          timestamp: now,
          payload: {
            to: 'ops@vision-agent.security',
            subject: `[${ctx.cameraId}] ${useCase.name} — ${trackedCount} detections`,
          },
        })
      }
      reasoning += ` | T2 snapshot+log${allowAutoAction ? '+email' : ''}`
    }

    // Tier 3: LLM judge + escalate + report (only at agentic level)
    if (allowEscalation && !breakerTripped && sustainCount >= (config.t3Sustain)) {
      tier = 3
      if (allowLLM && ctx.llmJudgeEnabled) {
        actions.push({ name: 'llm_judge', tier: 3, reason: `LLM false-positive filter for [${useCase.name}]`, timestamp: now })
      }
      actions.push({ name: 'escalate', tier: 3, reason: `critical escalation: ${ruleReason}`, timestamp: now })
      actions.push({ name: 'generate_report', tier: 3, reason: `auto-generate ${useCase.indeciReport ? 'INDECI ' : ''}incident report`, timestamp: now })
      reasoning += ` | T3 escalate${allowLLM && ctx.llmJudgeEnabled ? '+judge' : ''}+report`
    } else if (breakerTripped && allowEscalation) {
      reasoning += ` | T3 BLOCKED by circuit breaker (${recentEscalations.length}/${config.maxEscalationsPerHour}/hr)`
    }

    // Cognitive level: add LLM description but no autonomous action
    if (capabilityLevel === 'cognitive' && tier >= 1) {
      actions.push({ name: 'llm_judge', tier: 1, reason: `cognitive description of [${useCase.name}]`, timestamp: now })
      reasoning += ` | cognitive description`
    }
  }

  return {
    tier,
    actions,
    reasoning,
    sustainCount,
  }
}

/**
 * Point-in-polygon test (ray-casting algorithm).
 * Used for ROI breach detection.
 */
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

// NOTE: USE_CASES has moved to /src/lib/use-cases.ts with 15 full use case
// definitions (commercial + disaster) including ruleType, params, and actions.
// The old 4-use-case export has been removed to avoid confusion.
