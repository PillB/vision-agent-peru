import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDecisionFlowSvg } from '../../src/lib/flow-export'

test('decision-flow export contains every stage and the authoritative active state', () => {
  const svg = buildDecisionFlowSvg({
    title: 'Avalancha de Multitud',
    cycleLabel: 'Cycle #7',
    judgeBranch: 'skipped',
    activeStage: 'EXECUTE',
    stages: [
      { stage: 'OBSERVE', status: 'pass', detail: '20 measured local tracks' },
      { stage: 'VALIDATE_EVIDENCE', status: 'pass', detail: 'Evidence accepted' },
      { stage: 'POLICY', status: 'pass', detail: 'Tier 2' },
      { stage: 'JUDGE', status: 'skip', detail: 'Not requested' },
      { stage: 'VALIDATE_JUDGE', status: 'skip', detail: 'Not requested' },
      { stage: 'PROPOSE_ACTION', status: 'pass', detail: 'Two tasks' },
      { stage: 'APPROVAL', status: 'skip', detail: 'Local actions only' },
      { stage: 'EXECUTE', status: 'pending', detail: 'Running' },
      { stage: 'VERIFY_OUTCOME', status: 'pending', detail: 'Waiting' },
    ],
    tasks: ['snapshot', 'log_hit'],
  })

  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  for (const stage of [
    'OBSERVE', 'VALIDATE_EVIDENCE', 'POLICY', 'JUDGE', 'VALIDATE_JUDGE',
    'PROPOSE_ACTION', 'APPROVAL', 'EXECUTE', 'VERIFY_OUTCOME',
  ]) assert.match(svg, new RegExp(`data-stage="${stage}"`))
  assert.match(svg, /data-active="true"[^>]*data-stage="EXECUTE"|data-stage="EXECUTE"[^>]*data-active="true"/)
  assert.match(svg, /20 measured local tracks/)
  assert.match(svg, /snapshot/)
})

test('decision-flow export escapes operator-provided labels', () => {
  const svg = buildDecisionFlowSvg({
    title: '<script>alert("x")</script>',
    cycleLabel: 'Cycle & 1',
    judgeBranch: 'requested',
    stages: [],
    tasks: [],
  })

  assert.doesNotMatch(svg, /<script>/)
  assert.match(svg, /&lt;script&gt;/)
  assert.match(svg, /Cycle &amp; 1/)
})
