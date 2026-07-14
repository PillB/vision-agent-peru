/**
 * Agentic decision engine — consumes anomaly stats + context and decides actions.
 *
 * Architecture mirrors the research synthesis (Task 0-b):
 *   - Rule registry (data, not code) → easy to extend
 *   - 3-tier escalation: Tier 1 (badge) → Tier 2 (snapshot + email sim) → Tier 3 (LLM judge + escalation)
 *   - Sustain counter: anomaly must persist N ticks before escalating
 *   - LLM-as-judge: optional server call to filter false positives at Tier ≥ 3
 *   - Acknowledge/Silence: human-in-the-loop circuit breaker
 *
 * SEPARATION OF CONCERNS — the agent layer is distinct from the analytics layer:
 *   - Analytics layer (anomaly.ts): pure math on detection counts
 *   - Agentic layer (this file): reasoning + action dispatch
 */

import type { AnomalyStats } from './anomaly'

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
}

/**
 * The agent's perceive→reason→act loop.
 *
 * Pure function — given context, returns the decision (tier + actions + reasoning).
 * Side-effectful action EXECUTION (snapshot, email, report) is dispatched elsewhere
 * by the caller; this function only DECIDES.
 */
export function decide(ctx: AgentContext, config: AgentConfig = DEFAULT_AGENT_CONFIG): AgentDecision {
  const { stats, sustainCount, escalationHistory, acknowledgedUntil } = ctx
  const now = Date.now()
  const silenced = now < acknowledgedUntil

  // Recent escalation count (last hour)
  const recentEscalations = escalationHistory.filter((t) => now - t < 3600_000)
  const breakerTripped = recentEscalations.length >= config.maxEscalationsPerHour

  const actions: Action[] = []
  let tier: Tier = 0
  let reasoning = `Tick: ${stats.count} persons | z=${stats.zScore.toFixed(2)} peakZ=${stats.peakZ.toFixed(2)} | EMA=${stats.ema.toFixed(1)} | sustain=${sustainCount}`

  // Always log the tick (low-cost telemetry)
  actions.push({
    name: 'log_tick',
    tier: 0,
    reason: `count=${stats.count} z=${stats.zScore.toFixed(2)} peakZ=${stats.peakZ.toFixed(2)} mean=${stats.mean.toFixed(1)} σ=${stats.stddev.toFixed(1)}`,
    timestamp: now,
  })

  if (silenced) {
    return {
      tier: 0,
      actions,
      reasoning: reasoning + ' | SILENCED by operator',
      sustainCount,
    }
  }

  // Tier 1: anomaly detected (peakZ > t1Z) → badge
  if (stats.peakZ > config.t1Z) {
    tier = 1
    actions.push({
      name: 'badge',
      tier: 1,
      reason: `peakZ=${stats.peakZ.toFixed(2)} > ${config.t1Z}`,
      timestamp: now,
    })
    reasoning += ` | T1 badge`
  }

  // Tier 2: sustained anomaly → snapshot + email sim + log hit
  // Uses peakZ (max z over last 3 ticks) so a sharp spike that the sliding-window
  // σ catches up to still triggers escalation.
  if (
    stats.peakZ > config.t2Z &&
    sustainCount >= config.t2Sustain
  ) {
    tier = 2
    actions.push({
      name: 'snapshot',
      tier: 2,
      reason: `sustained peakZ>${config.t2Z} for ${sustainCount} ticks`,
      timestamp: now,
    })
    actions.push({
      name: 'log_hit',
      tier: 2,
      reason: `detailed incident record: count=${stats.count} peakZ=${stats.peakZ.toFixed(2)}`,
      timestamp: now,
      payload: {
        count: stats.count,
        zScore: stats.zScore,
        peakZ: stats.peakZ,
        mean: stats.mean,
        stddev: stats.stddev,
        ema: stats.ema,
      },
    })
    actions.push({
      name: 'send_email',
      tier: 2,
      reason: `automated notification to ops@cusco-vision.agent`,
      timestamp: now,
      payload: {
        to: 'ops@cusco-vision.agent',
        subject: `[${ctx.cameraId}] Anomaly detected — ${stats.count} persons (peakZ=${stats.peakZ.toFixed(2)})`,
      },
    })
    reasoning += ` | T2 snapshot+email+log`
  }

  // Tier 3: critical sustained → LLM judge + escalate (unless breaker tripped)
  if (
    stats.peakZ > config.t3Z &&
    sustainCount >= config.t3Sustain &&
    !breakerTripped
  ) {
    tier = 3
    if (ctx.llmJudgeEnabled) {
      actions.push({
        name: 'llm_judge',
        tier: 3,
        reason: `VLM/LLM false-positive filter on snapshot`,
        timestamp: now,
      })
    }
    actions.push({
      name: 'escalate',
      tier: 3,
      reason: `critical sustained peakZ>${config.t3Z} for ${sustainCount} ticks — Tier 3 escalation`,
      timestamp: now,
    })
    actions.push({
      name: 'generate_report',
      tier: 3,
      reason: `auto-generate incident report with evidence trail`,
      timestamp: now,
    })
    reasoning += ` | T3 escalate${ctx.llmJudgeEnabled ? '+judge' : ''}+report`
  } else if (breakerTripped && stats.peakZ > config.t3Z) {
    reasoning += ` | T3 BLOCKED by circuit breaker (${recentEscalations.length}/${config.maxEscalationsPerHour}/hr)`
  }

  return {
    tier,
    actions,
    reasoning,
    sustainCount,
  }
}

/**
 * Use-case rules — high-level "what does this trigger?" mappings used by the UI.
 * Mirrors the 4 v1 use cases from research: crowd surge, loitering, abandoned object,
 * restricted-zone breach. The prototype implements crowd surge + sustained density
 * escalation directly; loitering/abandoned/restricted-zone are explained on Tab 1
 * and would activate the same agent pipeline with different rule params.
 */
export const USE_CASES = [
  {
    id: 'crowd_surge',
    name: 'Crowd Surge Detection',
    signal: 'z > 2.5 sustained for 3 ticks',
    tier: 2,
    value: 'Early crowd-control dispatch — 8 min before manual review would catch it.',
  },
  {
    id: 'sustained_density',
    name: 'Sustained High-Density Escalation',
    signal: 'z > 3.5 sustained for 3 ticks',
    tier: 3,
    value: 'Auto-generate incident report + escalate to operations lead.',
  },
  {
    id: 'loitering',
    name: 'Loitering Detection',
    signal: 'tracked person stationary > 5 min in ROI',
    tier: 2,
    value: 'Flag unwelcome gathering before incident occurs.',
  },
  {
    id: 'restricted_zone',
    name: 'Restricted-Zone Breach',
    signal: 'person centroid inside polygon',
    tier: 3,
    value: 'Immediate Tier 3 escalation with snapshot evidence.',
  },
] as const
