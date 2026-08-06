/**
 * Incident State Machine + Idempotent Actions — Round 5
 *
 * Implements section 20 of the Solarize system prompt:
 *   - Explicit sequential state machine
 *   - Deterministic policy owns authority (LLM cannot raise severity)
 *   - Sequential judge gating (no parallel judge + escalate)
 *   - Approval workflow for external actions
 *   - Idempotent actions (idempotency key prevents duplicates)
 *   - Outcome verification + retry + compensation
 *
 * State machine:
 *   observed → candidate → evidence_validated → policy_evaluated →
 *   action_proposed → pending_approval → executing → outcome_verification →
 *   succeeded | failed | compensating → closed
 *
 * Public static action allowlist (section 20):
 *   GitHub Pages may perform automatically:
 *     - local badge
 *     - local event log
 *     - local snapshot
 *     - local deterministic draft report
 *     - browser notification (after permission)
 *     - explicit simulation
 *
 *   Require approval + configured authenticated service for:
 *     - email
 *     - ticket creation
 *     - messaging
 *     - security dispatch
 *     - access-control changes
 *     - emergency communication
 *     - external evidence transmission
 */

import type { ActionName } from './agent'

export type IncidentState =
  | 'observed'
  | 'candidate'
  | 'evidence_validated'
  | 'policy_evaluated'
  | 'action_proposed'
  | 'pending_approval'
  | 'executing'
  | 'outcome_verification'
  | 'succeeded'
  | 'failed'
  | 'compensating'
  | 'closed'

export interface Incident {
  id: string
  state: IncidentState
  createdAt: number
  updatedAt: number
  cameraId: string
  useCaseId: string
  evidenceIds: string[]
  proposedActions: ActionName[]
  approvedActions: ActionName[]
  rejectedActions: ActionName[]
  /** History of state transitions for audit. */
  transitions: Array<{
    from: IncidentState
    to: IncidentState
    timestamp: number
    reason: string
    actor: 'system' | 'policy' | 'judge' | 'reviewer' | 'operator'
  }>
  /** Idempotency keys for executed actions (prevents duplicate execution). */
  executedActionKeys: Map<string, ActionExecution>
  /** Outcome of the most recent execution attempt. */
  lastOutcome?: {
    action: ActionName
    status: 'succeeded' | 'failed' | 'compensated' | 'pending_verification'
    timestamp: number
    message: string
    retryCount: number
  }
}

export interface ActionExecution {
  actionName: ActionName
  idempotencyKey: string
  status: 'pending' | 'executing' | 'succeeded' | 'failed' | 'compensated'
  attempts: number
  maxAttempts: number
  startedAt: number
  completedAt?: number
  response?: unknown
  error?: string
  compensationAction?: ActionName
}

// ─── Allowed automatic actions on GitHub Pages (no service needed) ───
export const GH_PAGES_AUTO_ACTIONS: ActionName[] = [
  'badge',
  'log_hit',
  'snapshot',
  'generate_report',  // local deterministic draft only
]

// ─── Actions that REQUIRE approval + configured authenticated service ───
export const APPROVAL_REQUIRED_ACTIONS: ActionName[] = [
  'send_email',
  'escalate',  // external escalation requires approval
  // 'ticket_creation', 'messaging', 'security_dispatch' — not in current ActionName
]

/**
 * Validate a state transition. Returns true if the transition is allowed.
 *
 * This enforces the sequential state machine — you can't skip stages.
 */
export function canTransition(from: IncidentState, to: IncidentState): boolean {
  const allowed: Record<IncidentState, IncidentState[]> = {
    observed: ['candidate', 'closed'],
    candidate: ['evidence_validated', 'closed'],
    evidence_validated: ['policy_evaluated', 'closed'],
    policy_evaluated: ['action_proposed', 'closed'],
    action_proposed: ['pending_approval', 'executing', 'closed'],
    pending_approval: ['executing', 'closed'],
    executing: ['outcome_verification', 'failed', 'closed'],
    outcome_verification: ['succeeded', 'failed', 'compensating', 'closed'],
    succeeded: ['closed'],
    failed: ['compensating', 'closed'],
    compensating: ['closed'],
    closed: [],
  }
  return allowed[from]?.includes(to) ?? false
}

/**
 * Transition an incident to a new state.
 * Throws if the transition is invalid.
 */
export function transitionIncident(
  incident: Incident,
  to: IncidentState,
  reason: string,
  actor: Incident['transitions'][0]['actor'] = 'system',
): Incident {
  if (!canTransition(incident.state, to)) {
    throw new Error(`Invalid state transition: ${incident.state} → ${to}`)
  }
  const now = Date.now()
  return {
    ...incident,
    state: to,
    updatedAt: now,
    transitions: [
      ...incident.transitions,
      { from: incident.state, to, timestamp: now, reason, actor },
    ],
  }
}

/**
 * Create a new incident in the 'observed' state.
 */
export function createIncident(
  cameraId: string,
  useCaseId: string,
  evidenceIds: string[] = [],
): Incident {
  const now = Date.now()
  return {
    id: `inc-${now}-${Math.random().toString(36).slice(2, 8)}`,
    state: 'observed',
    createdAt: now,
    updatedAt: now,
    cameraId,
    useCaseId,
    evidenceIds,
    proposedActions: [],
    approvedActions: [],
    rejectedActions: [],
    transitions: [],
    executedActionKeys: new Map(),
  }
}

/**
 * Generate an idempotency key for an action on an incident.
 * Same incident + same action → same key. This prevents duplicate execution
 * even if the action is requested multiple times (e.g., due to retry).
 */
export function getIdempotencyKey(incidentId: string, actionName: ActionName): string {
  return `${incidentId}:${actionName}`
}

/**
 * Check if an action has already been executed (idempotency check).
 * Returns the existing execution record, or null if not yet executed.
 */
export function checkIdempotency(
  incident: Incident,
  actionName: ActionName,
): ActionExecution | null {
  const key = getIdempotencyKey(incident.id, actionName)
  return incident.executedActionKeys.get(key) ?? null
}

/**
 * Record an action execution on an incident.
 * If the action was already executed, returns the existing record (idempotent).
 */
export function recordActionExecution(
  incident: Incident,
  actionName: ActionName,
  status: ActionExecution['status'],
  options: {
    maxAttempts?: number
    response?: unknown
    error?: string
    compensationAction?: ActionName
  } = {},
): { incident: Incident; execution: ActionExecution; wasNew: boolean } {
  const key = getIdempotencyKey(incident.id, actionName)
  const existing = incident.executedActionKeys.get(key)
  if (existing && existing.status === 'succeeded') {
    // Idempotent: action already succeeded, don't re-execute
    return { incident, execution: existing, wasNew: false }
  }

  const now = Date.now()
  const execution: ActionExecution = existing
    ? {
        ...existing,
        status,
        attempts: existing.attempts + 1,
        completedAt: status === 'succeeded' || status === 'failed' || status === 'compensated' ? now : undefined,
        response: options.response ?? existing.response,
        error: options.error ?? existing.error,
        compensationAction: options.compensationAction ?? existing.compensationAction,
      }
    : {
        actionName,
        idempotencyKey: key,
        status,
        attempts: 1,
        maxAttempts: options.maxAttempts ?? 3,
        startedAt: now,
        completedAt: status === 'succeeded' || status === 'failed' || status === 'compensated' ? now : undefined,
        response: options.response,
        error: options.error,
        compensationAction: options.compensationAction,
      }

  const newMap = new Map(incident.executedActionKeys)
  newMap.set(key, execution)
  return {
    incident: { ...incident, executedActionKeys: newMap, updatedAt: now },
    execution,
    wasNew: !existing,
  }
}

/**
 * Check if an action requires human approval before execution.
 *
 * Per section 20: external actions (email, escalate, ticket, messaging,
 * dispatch, access-control, emergency, external evidence) require approval.
 */
export function requiresApproval(actionName: ActionName): boolean {
  return APPROVAL_REQUIRED_ACTIONS.includes(actionName)
}

/**
 * Check if an action is allowed to execute automatically on GitHub Pages
 * (no authenticated service available).
 */
export function isAutoAllowedOnGhPages(actionName: ActionName): boolean {
  return GH_PAGES_AUTO_ACTIONS.includes(actionName)
}

/**
 * Sequential judge gating (section 20):
 *   collect evidence → verify judge capability → invoke judge → validate
 *   structured output → apply deterministic policy → propose action →
 *   request approval → execute
 *
 * NEVER run judge and escalation in parallel.
 *
 * This function returns the correct execution order for a set of actions.
 * Judge (if any) must come BEFORE escalate (if any).
 */
export function orderActionsSequentially(actions: ActionName[]): ActionName[] {
  const ordered: ActionName[] = []
  // 1. Judge first (if present)
  if (actions.includes('llm_judge')) ordered.push('llm_judge')
  // 2. Local actions (badge, log_hit, snapshot)
  if (actions.includes('badge')) ordered.push('badge')
  if (actions.includes('log_hit')) ordered.push('log_hit')
  if (actions.includes('snapshot')) ordered.push('snapshot')
  // 3. Generate report (local deterministic draft)
  if (actions.includes('generate_report')) ordered.push('generate_report')
  // 4. External actions (require approval) — LAST
  if (actions.includes('send_email')) ordered.push('send_email')
  if (actions.includes('escalate')) ordered.push('escalate')
  return ordered
}

/**
 * Compute the outcome of an action execution.
 * If failed, determine whether to retry, compensate, or give up.
 *
 * Returns the next state the incident should transition to.
 */
export function computeOutcome(
  incident: Incident,
  actionName: ActionName,
  execution: ActionExecution,
): {
  nextState: IncidentState
  shouldRetry: boolean
  shouldCompensate: boolean
  reason: string
} {
  if (execution.status === 'succeeded') {
    return {
      nextState: 'outcome_verification',
      shouldRetry: false,
      shouldCompensate: false,
      reason: `Action ${actionName} succeeded`,
    }
  }

  if (execution.status === 'failed') {
    if (execution.attempts < execution.maxAttempts) {
      return {
        nextState: 'executing',  // retry — stay in executing state
        shouldRetry: true,
        shouldCompensate: false,
        reason: `Action ${actionName} failed (attempt ${execution.attempts}/${execution.maxAttempts}) — will retry`,
      }
    }
    // Max attempts reached — compensate
    if (execution.compensationAction) {
      return {
        nextState: 'compensating',
        shouldRetry: false,
        shouldCompensate: true,
        reason: `Action ${actionName} failed after ${execution.attempts} attempts — compensating with ${execution.compensationAction}`,
      }
    }
    return {
      nextState: 'failed',
      shouldRetry: false,
      shouldCompensate: false,
      reason: `Action ${actionName} failed after ${execution.attempts} attempts — no compensation available`,
    }
  }

  return {
    nextState: incident.state,
    shouldRetry: false,
    shouldCompensate: false,
    reason: `Action ${actionName} status: ${execution.status}`,
  }
}

/**
 * Static capability profile — determines what actions are available
 * based on the deployment environment.
 *
 * Per section 21:
 *   - GitHub Pages local-only: no API calls, no LLM service, no real email
 *   - Configured secure service: full external actions with auth
 *   - Development: local API routes + test fixtures + visible badge
 */
export type CapabilityProfile = 'github_pages' | 'secure_service' | 'development'

export interface ProfileCapabilities {
  profile: CapabilityProfile
  apiRoutesAvailable: boolean
  llmJudgeAvailable: boolean
  realEmailAvailable: boolean
  realEscalationAvailable: boolean
  realReportGeneration: boolean
  autoActions: ActionName[]
  approvalRequiredActions: ActionName[]
  /** Badge shown in the UI. */
  badge: string
}

export function getProfileCapabilities(profile: CapabilityProfile): ProfileCapabilities {
  switch (profile) {
    case 'github_pages':
      return {
        profile,
        apiRoutesAvailable: false,
        llmJudgeAvailable: false,
        realEmailAvailable: false,
        realEscalationAvailable: false,
        realReportGeneration: false,  // local deterministic draft only
        autoActions: GH_PAGES_AUTO_ACTIONS,
        approvalRequiredActions: APPROVAL_REQUIRED_ACTIONS,
        badge: 'GitHub Pages · local-only · simulated external actions',
      }
    case 'secure_service':
      return {
        profile,
        apiRoutesAvailable: true,
        llmJudgeAvailable: true,
        realEmailAvailable: true,
        realEscalationAvailable: true,
        realReportGeneration: true,
        autoActions: GH_PAGES_AUTO_ACTIONS,
        approvalRequiredActions: APPROVAL_REQUIRED_ACTIONS,
        badge: 'Secure service · authenticated · real external actions',
      }
    case 'development':
      return {
        profile,
        apiRoutesAvailable: true,
        llmJudgeAvailable: true,
        realEmailAvailable: false,  // simulated in dev
        realEscalationAvailable: false,
        realReportGeneration: true,
        autoActions: GH_PAGES_AUTO_ACTIONS,
        approvalRequiredActions: APPROVAL_REQUIRED_ACTIONS,
        badge: 'Development · local API routes · test fixtures',
      }
  }
}

/**
 * Detect the current capability profile from the browser environment.
 */
export function detectProfile(): CapabilityProfile {
  if (typeof window === 'undefined') return 'development'
  const host = window.location.hostname
  const path = window.location.pathname
  if (host.includes('github.io') || path.includes('/vision-agent-peru/')) {
    return 'github_pages'
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'development'
  }
  // If on a custom domain with API routes, assume secure service
  return 'secure_service'
}
