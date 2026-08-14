import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAgentCycleSnapshot } from '../../src/lib/decision-flow'
import type { AgentDecision } from '../../src/lib/agent'
import { USE_CASES } from '../../src/lib/use-cases'

test('decision telemetry mirrors the authoritative decision actions and use-case gates', () => {
  const useCase = USE_CASES.find(candidate => candidate.id === 'auto_report')!
  const decision: AgentDecision = {
    tier: 3,
    actions: [
      { name: 'llm_judge', tier: 3, reason: 'review evidence', timestamp: 100 },
      { name: 'escalate', tier: 3, reason: 'critical incident', timestamp: 100 },
      { name: 'generate_report', tier: 3, reason: 'draft report', timestamp: 100 },
    ],
    reasoning: 'Density anomaly sustained and escalation policy fired.',
    sustainCount: 6,
  }

  const snapshot = buildAgentCycleSnapshot({
    cycleNumber: 7,
    startedAt: 100,
    cameraId: 'cam-a',
    cameraLabel: 'Camera A',
    capabilityLevel: 'agentic',
    useCase,
    decision,
    evidence: { detectionCount: 4, sustainCount: 6, peakZ: 4.2 },
  })

  assert.deepEqual(snapshot.proposedActions.map(action => action.name), [
    'llm_judge',
    'escalate',
    'generate_report',
  ])
  assert.equal(snapshot.tier, 3)
  assert.equal(snapshot.requiresApproval, true)
  assert.equal(snapshot.judgeBranch, 'requested')
  assert.equal(snapshot.trace.find(stage => stage.stage === 'PROPOSE_ACTION')?.result?.actionCount, 3)
  assert.match(snapshot.trace.find(stage => stage.stage === 'POLICY')?.detail ?? '', /Density anomaly sustained/)
})

test('decision telemetry records the no-action branch without inventing tasks', () => {
  const useCase = USE_CASES.find(candidate => candidate.id === 'crowd_surge')!
  const decision: AgentDecision = {
    tier: 0,
    actions: [],
    reasoning: 'Crowd Surge Detection: z=0.20. Nominal.',
    sustainCount: 0,
  }

  const snapshot = buildAgentCycleSnapshot({
    cycleNumber: 2,
    startedAt: 200,
    cameraId: 'cam-b',
    cameraLabel: 'Camera B',
    capabilityLevel: 'mldl',
    useCase,
    decision,
    evidence: { detectionCount: 1, sustainCount: 0, peakZ: 0.2 },
  })

  assert.equal(snapshot.proposedActions.length, 0)
  assert.equal(snapshot.judgeBranch, 'skipped')
  assert.equal(snapshot.requiresApproval, false)
  assert.equal(snapshot.trace.find(stage => stage.stage === 'POLICY')?.status, 'skip')
  assert.equal(snapshot.trace.find(stage => stage.stage === 'EXECUTE')?.status, 'skip')
})
