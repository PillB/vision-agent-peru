import assert from 'node:assert/strict'
import test from 'node:test'
import { runControlledActions, type ControlledActionEvent } from '../../src/lib/action-orchestrator'

const proposed = ['llm_judge', 'generate_report', 'send_email', 'escalate'] as const

test('false-positive judge prevents every external escalation and report action', async () => {
  const events: ControlledActionEvent[] = []
  const result = await runControlledActions({
    incidentId: 'incident-fp',
    proposedActions: [...proposed],
    allowedActions: [...proposed],
    profile: 'secure_service',
    evidence: { available: true, visual: true, evidenceIds: ['ev-1'] },
    judge: async () => ({ verdict: 'false_positive', confidence: 0.91, reason: 'negative control' }),
    approval: async () => true,
    execute: async (action) => {
      events.push({ stage: 'execute', action, status: 'succeeded', timestamp: Date.now() })
      return { ok: true, verified: true, message: 'ok' }
    },
    onEvent: event => events.push(event),
  })

  assert.equal(result.outcome, 'suppressed_false_positive')
  assert.deepEqual(result.executedActions, [])
  assert.equal(events.some(event => ['send_email', 'escalate', 'generate_report'].includes(event.action ?? '')), false)
})

test('GitHub Pages performs local report without an API request and blocks external actions', async () => {
  const executed: string[] = []
  const result = await runControlledActions({
    incidentId: 'incident-static',
    proposedActions: ['generate_report', 'send_email', 'escalate'],
    allowedActions: ['generate_report', 'send_email', 'escalate'],
    profile: 'github_pages',
    evidence: { available: true, visual: true, evidenceIds: ['ev-2'] },
    approval: async () => true,
    execute: async action => {
      executed.push(action)
      return { ok: true, verified: true, message: 'local deterministic draft' }
    },
  })

  assert.deepEqual(executed, ['generate_report'])
  assert.deepEqual(result.unavailableActions.sort(), ['escalate', 'send_email'])
  assert.equal(result.executedActions[0]?.status, 'verified')
})

test('execution revalidates the use-case action allowlist', async () => {
  const executed: string[] = []
  const result = await runControlledActions({
    incidentId: 'incident-injection',
    proposedActions: ['send_email'],
    allowedActions: ['log_tick'],
    profile: 'secure_service',
    evidence: { available: true, visual: true, evidenceIds: ['ev-3'] },
    approval: async () => true,
    execute: async action => {
      executed.push(action)
      return { ok: true, verified: true, message: 'should not execute' }
    },
  })

  assert.deepEqual(executed, [])
  assert.deepEqual(result.rejectedActions, ['send_email'])
})

test('external action remains pending when approval is rejected', async () => {
  const result = await runControlledActions({
    incidentId: 'incident-rejected',
    proposedActions: ['send_email'],
    allowedActions: ['send_email'],
    profile: 'secure_service',
    evidence: { available: true, visual: true, evidenceIds: ['ev-4'] },
    approval: async () => false,
    execute: async () => ({ ok: true, verified: true, message: 'should not execute' }),
  })

  assert.deepEqual(result.approvalRejectedActions, ['send_email'])
  assert.deepEqual(result.executedActions, [])
})

test('failed verification retries, then compensates without claiming success', async () => {
  let attempts = 0
  let compensations = 0
  const result = await runControlledActions({
    incidentId: 'incident-retry', proposedActions: ['generate_report'], allowedActions: ['generate_report'],
    profile: 'github_pages', evidence: { available: true, visual: true, evidenceIds: ['ev-5'] },
    approval: async () => false, maxAttempts: 2,
    execute: async () => { attempts++; return { ok: false, verified: false, message: 'write verification failed' } },
    compensate: async () => { compensations++; return { ok: true, message: 'partial draft removed' } },
  })
  assert.equal(attempts, 2)
  assert.equal(compensations, 1)
  assert.equal(result.outcome, 'failed')
  assert.equal(result.executedActions[0].status, 'failed')
})

test('idempotency and circuit breaker block duplicate or excessive external execution', async () => {
  const keys = new Set<string>(['incident-duplicate:generate_report'])
  let calls = 0
  const duplicate = await runControlledActions({
    incidentId: 'incident-duplicate', proposedActions: ['generate_report'], allowedActions: ['generate_report'],
    profile: 'github_pages', evidence: { available: true, visual: true, evidenceIds: ['ev-6'] },
    approval: async () => true, executedActionKeys: keys,
    execute: async () => { calls++; return { ok: true, verified: true, message: 'ok' } },
  })
  assert.equal(calls, 0)
  assert.equal(duplicate.events.some(event => event.detail?.includes('Duplicate blocked')), true)

  const breaker = await runControlledActions({
    incidentId: 'incident-breaker', proposedActions: ['send_email'], allowedActions: ['send_email'],
    profile: 'secure_service', evidence: { available: true, visual: true, evidenceIds: ['ev-7'] },
    approval: async () => true, externalCircuitBreakerOpen: true,
    execute: async () => { calls++; return { ok: true, verified: true, message: 'ok' } },
  })
  assert.equal(calls, 0)
  assert.deepEqual(breaker.rejectedActions, ['send_email'])
})
