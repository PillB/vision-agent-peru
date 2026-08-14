import type { Action, AgentDecision, Tier } from './agent'
import type { StageTrace } from './agentic-response'
import type { CapabilityLevel, UseCase } from './use-cases'

export const AGENT_STAGE_ORDER = [
  'OBSERVE',
  'VALIDATE_EVIDENCE',
  'POLICY',
  'JUDGE',
  'VALIDATE_JUDGE',
  'PROPOSE_ACTION',
  'APPROVAL',
  'EXECUTE',
  'VERIFY_OUTCOME',
] as const

export interface AgentCycleSnapshot {
  cycleId: string
  cycleNumber: number
  startedAt: number
  cameraId: string
  cameraLabel: string
  useCaseId: string
  useCaseName: string
  ruleType: UseCase['ruleType']
  capabilityLevel: CapabilityLevel
  tier: Tier
  reasoning: string
  proposedActions: Action[]
  allowedActions: string[]
  requiresApproval: boolean
  judgeBranch: 'requested' | 'skipped'
  evidence: {
    detectionCount: number
    sustainCount: number
    peakZ: number
  }
  trace: StageTrace[]
}

interface BuildAgentCycleSnapshotInput {
  cycleNumber: number
  startedAt: number
  cameraId: string
  cameraLabel: string
  capabilityLevel: CapabilityLevel
  useCase: UseCase
  decision: AgentDecision
  evidence: AgentCycleSnapshot['evidence']
}

/**
 * Builds VP-facing decision telemetry from the same AgentDecision that is sent
 * to the action executor. It intentionally records concise policy evidence and
 * gate outcomes, not private chain-of-thought.
 */
export function buildAgentCycleSnapshot(input: BuildAgentCycleSnapshotInput): AgentCycleSnapshot {
  const { decision, useCase, evidence, startedAt } = input
  const proposedNames = decision.actions.map(action => action.name)
  const judgeBranch = proposedNames.includes('llm_judge') ? 'requested' : 'skipped'
  const requiresApproval = proposedNames.some(name => name === 'send_email' || name === 'escalate')
  const hasDecision = decision.actions.length > 0 || decision.tier > 0
  const actionLabel = proposedNames.length > 0 ? proposedNames.join(', ') : 'none'

  const trace: StageTrace[] = [
    {
      stage: 'OBSERVE',
      status: 'pass',
      timestamp: startedAt,
      detail: `${evidence.detectionCount} detections · peakZ ${evidence.peakZ.toFixed(2)} · sustain ${evidence.sustainCount}`,
      result: { cameraId: input.cameraId, useCaseId: useCase.id },
    },
    {
      stage: 'VALIDATE_EVIDENCE',
      status: 'pass',
      timestamp: startedAt,
      detail: 'Finite scores and geometry reached the deterministic decision engine.',
      result: { detectionCount: evidence.detectionCount },
    },
    {
      stage: 'POLICY',
      status: hasDecision ? 'pass' : 'skip',
      timestamp: startedAt,
      detail: decision.reasoning,
      result: { ruleType: useCase.ruleType, tier: decision.tier },
    },
    {
      stage: 'JUDGE',
      status: judgeBranch === 'requested' ? 'pending' : 'skip',
      timestamp: startedAt,
      detail: judgeBranch === 'requested'
        ? 'Advisory judge requested before judge-gated actions.'
        : 'Judge not requested by the authoritative decision.',
    },
    {
      stage: 'VALIDATE_JUDGE',
      status: judgeBranch === 'requested' ? 'pending' : 'skip',
      timestamp: startedAt,
      detail: judgeBranch === 'requested'
        ? 'Executor will fail closed on unavailable, malformed, or inconclusive judge output.'
        : 'No judge output to validate.',
    },
    {
      stage: 'PROPOSE_ACTION',
      status: decision.actions.length > 0 ? 'pass' : 'skip',
      timestamp: startedAt,
      detail: `${decision.actions.length} authorized task(s): ${actionLabel}`,
      result: { actionCount: decision.actions.length, actions: proposedNames },
    },
    {
      stage: 'APPROVAL',
      status: decision.actions.length === 0 ? 'skip' : (requiresApproval ? 'pending' : 'pass'),
      timestamp: startedAt,
      detail: decision.actions.length === 0
        ? 'No action requires approval.'
        : requiresApproval
          ? 'External actions require explicit approval and a configured service.'
          : 'Local action set can execute within the static profile.',
      result: { requiresApproval },
    },
    {
      stage: 'EXECUTE',
      status: decision.actions.length > 0 ? 'pending' : 'skip',
      timestamp: startedAt,
      detail: decision.actions.length > 0
        ? 'Serialized executor received this exact authorized task list.'
        : 'No tasks dispatched.',
      result: { actions: proposedNames },
    },
    {
      stage: 'VERIFY_OUTCOME',
      status: decision.actions.length > 0 ? 'pending' : 'skip',
      timestamp: startedAt,
      detail: decision.actions.length > 0
        ? 'Action outcomes are reconciled from the live audit log.'
        : 'Nominal cycle; no action outcome to verify.',
    },
  ]

  return {
    cycleId: `cycle-${input.cycleNumber}-${startedAt}`,
    cycleNumber: input.cycleNumber,
    startedAt,
    cameraId: input.cameraId,
    cameraLabel: input.cameraLabel,
    useCaseId: useCase.id,
    useCaseName: useCase.name,
    ruleType: useCase.ruleType,
    capabilityLevel: input.capabilityLevel,
    tier: decision.tier,
    reasoning: decision.reasoning,
    proposedActions: decision.actions,
    allowedActions: [...useCase.actions],
    requiresApproval,
    judgeBranch,
    evidence,
    trace,
  }
}
