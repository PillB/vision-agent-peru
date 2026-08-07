import type { ActionName } from './agent'
import type { CapabilityProfile } from './incident-state-machine'

export type JudgeVerdict = 'real' | 'false_positive' | 'inconclusive'

export interface JudgeResult {
  verdict: JudgeVerdict
  confidence: number
  reason: string
}

export interface ControlledActionEvent {
  stage:
    | 'observe'
    | 'validate_evidence'
    | 'apply_policy'
    | 'invoke_judge'
    | 'validate_judge'
    | 'propose_action'
    | 'request_approval'
    | 'execute'
    | 'verify_outcome'
    | 'retry'
    | 'compensate'
    | 'close'
  action?: ActionName
  status: 'started' | 'succeeded' | 'failed' | 'blocked' | 'unavailable' | 'rejected'
  timestamp: number
  detail?: string
}

export interface ControlledActionResult {
  outcome: 'completed' | 'suppressed_false_positive' | 'inconclusive' | 'failed'
  events: ControlledActionEvent[]
  executedActions: Array<{ action: ActionName; status: 'verified' | 'failed'; message: string }>
  rejectedActions: ActionName[]
  unavailableActions: ActionName[]
  approvalRejectedActions: ActionName[]
  judgeResult?: JudgeResult
}

export interface RunControlledActionsOptions {
  incidentId: string
  proposedActions: ActionName[]
  allowedActions: ActionName[]
  profile: CapabilityProfile
  evidence: { available: boolean; visual: boolean; evidenceIds: string[] }
  judge?: () => Promise<JudgeResult>
  approval: (action: ActionName) => Promise<boolean>
  execute: (action: ActionName) => Promise<{ ok: boolean; verified: boolean; message: string }>
  compensate?: (action: ActionName) => Promise<{ ok: boolean; message: string }>
  maxAttempts?: number
  executedActionKeys?: Set<string>
  externalCircuitBreakerOpen?: boolean
  onEvent?: (event: ControlledActionEvent) => void
}

const EXTERNAL_ACTIONS = new Set<ActionName>(['send_email', 'escalate'])

function validJudgeResult(value: JudgeResult): boolean {
  return ['real', 'false_positive', 'inconclusive'].includes(value.verdict)
    && Number.isFinite(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
    && typeof value.reason === 'string'
    && value.reason.trim().length > 0
}

/**
 * The single authoritative action path. It is deliberately sequential:
 * observe → validate evidence → policy → optional judge → validate output →
 * propose → approval → execute → verify → close.
 *
 * The LLM is advisory. It may suppress an incident as a false positive but
 * can never add an action, raise severity, or bypass the deterministic
 * allowlist and approval rules.
 */
export async function runControlledActions(options: RunControlledActionsOptions): Promise<ControlledActionResult> {
  const events: ControlledActionEvent[] = []
  const emit = (event: Omit<ControlledActionEvent, 'timestamp'>) => {
    const complete = { ...event, timestamp: Date.now() }
    events.push(complete)
    options.onEvent?.(complete)
  }
  const result: ControlledActionResult = {
    outcome: 'completed',
    events,
    executedActions: [],
    rejectedActions: [],
    unavailableActions: [],
    approvalRejectedActions: [],
  }

  emit({ stage: 'observe', status: 'succeeded', detail: options.incidentId })
  if (!options.evidence.available || options.evidence.evidenceIds.length === 0) {
    emit({ stage: 'validate_evidence', status: 'failed', detail: 'No reviewable evidence' })
    result.outcome = 'inconclusive'
    return result
  }
  emit({ stage: 'validate_evidence', status: 'succeeded', detail: `${options.evidence.evidenceIds.length} evidence item(s)` })

  const allowed = new Set(options.allowedActions)
  const uniqueProposals = [...new Set(options.proposedActions)]
  const policyActions = uniqueProposals.filter(action => {
    if (allowed.has(action)) return true
    result.rejectedActions.push(action)
    emit({ stage: 'apply_policy', action, status: 'rejected', detail: 'Not in the use-case allowlist' })
    return false
  })
  emit({ stage: 'apply_policy', status: 'succeeded', detail: `${policyActions.length} action(s) allowed` })

  if (policyActions.includes('llm_judge')) {
    if (!options.evidence.visual) {
      emit({ stage: 'invoke_judge', action: 'llm_judge', status: 'blocked', detail: 'Visual evidence unavailable' })
      result.outcome = 'inconclusive'
      return result
    }
    if (options.profile === 'github_pages' || !options.judge) {
      emit({ stage: 'invoke_judge', action: 'llm_judge', status: 'unavailable', detail: 'No authenticated judge service' })
      result.outcome = 'inconclusive'
      return result
    }
    emit({ stage: 'invoke_judge', action: 'llm_judge', status: 'started' })
    const judgeResult = await options.judge()
    result.judgeResult = judgeResult
    if (!validJudgeResult(judgeResult)) {
      emit({ stage: 'validate_judge', action: 'llm_judge', status: 'failed', detail: 'Malformed judge output' })
      result.outcome = 'inconclusive'
      return result
    }
    emit({ stage: 'validate_judge', action: 'llm_judge', status: 'succeeded', detail: judgeResult.verdict })
    if (judgeResult.verdict === 'false_positive') {
      emit({ stage: 'close', status: 'blocked', detail: 'False-positive verdict suppressed all proposed actions' })
      result.outcome = 'suppressed_false_positive'
      return result
    }
    if (judgeResult.verdict === 'inconclusive') {
      emit({ stage: 'close', status: 'blocked', detail: 'Judge was inconclusive' })
      result.outcome = 'inconclusive'
      return result
    }
  }

  const executable = policyActions.filter(action => action !== 'llm_judge')
  for (const action of executable) {
    emit({ stage: 'propose_action', action, status: 'succeeded' })
    const external = EXTERNAL_ACTIONS.has(action)
    if (external && options.externalCircuitBreakerOpen) {
      result.rejectedActions.push(action)
      emit({ stage: 'apply_policy', action, status: 'blocked', detail: 'External-action circuit breaker is open' })
      continue
    }
    if (external && options.profile !== 'secure_service') {
      result.unavailableActions.push(action)
      emit({ stage: 'execute', action, status: 'unavailable', detail: 'Authenticated external service is not configured' })
      continue
    }
    if (external) {
      emit({ stage: 'request_approval', action, status: 'started' })
      const approved = await options.approval(action)
      if (!approved) {
        result.approvalRejectedActions.push(action)
        emit({ stage: 'request_approval', action, status: 'rejected' })
        continue
      }
      emit({ stage: 'request_approval', action, status: 'succeeded' })
    }

    const idempotencyKey = `${options.incidentId}:${action}`
    if (options.executedActionKeys?.has(idempotencyKey)) {
      emit({ stage: 'execute', action, status: 'blocked', detail: `Duplicate blocked by ${idempotencyKey}` })
      continue
    }
    const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
    let verified = false
    let message = 'No execution attempt'
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      emit({ stage: 'execute', action, status: 'started', detail: `attempt ${attempt}/${maxAttempts}` })
      const execution = await options.execute(action)
      verified = execution.ok && execution.verified
      message = execution.message
      emit({ stage: 'verify_outcome', action, status: verified ? 'succeeded' : 'failed', detail: execution.message })
      if (verified) break
      if (attempt < maxAttempts) emit({ stage: 'retry', action, status: 'started', detail: `retrying after failed verification ${attempt}` })
    }
    const status = verified ? 'verified' : 'failed'
    result.executedActions.push({ action, status, message })
    if (verified) options.executedActionKeys?.add(idempotencyKey)
    if (!verified) {
      result.outcome = 'failed'
      if (options.compensate) {
        const compensation = await options.compensate(action)
        emit({ stage: 'compensate', action, status: compensation.ok ? 'succeeded' : 'failed', detail: compensation.message })
      }
    }
  }

  emit({ stage: 'close', status: result.outcome === 'failed' ? 'failed' : 'succeeded' })
  return result
}
