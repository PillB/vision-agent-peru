import assert from 'node:assert/strict'
import test from 'node:test'
import { decide, DEFAULT_AGENT_CONFIG } from '../../src/lib/agent'
import { USE_CASES } from '../../src/lib/use-cases'
import type { AnomalyStats } from '../../src/lib/anomaly'

const stats: AnomalyStats = {
  count: 1, mean: 0, stddev: 1, zScore: 8, recentZ: 8, peakZ: 8,
  ema: 1, emaStd: 1, ewmaResidual: 0, ewmaAlarm: false,
  isAnomaly: true, isCritical: true, windowSize: 1, samples: [],
}

function decision(useCaseId: string, classes: string[], frameDiffScore?: number) {
  const useCase = USE_CASES.find(item => item.id === useCaseId)!
  return decide({
    stats,
    cameraId: 'test-camera',
    cameraLabel: 'Test camera',
    sustainCount: 4,
    escalationHistory: [],
    acknowledgedUntil: 0,
    llmJudgeEnabled: true,
    useCase,
    capabilityLevel: 'agentic',
    detections: classes.map(name => ({ class: name, score: 0.99, bbox: [0, 0, 10, 10] })),
    canvasW: 100,
    canvasH: 100,
    frameDiffScore,
  }, DEFAULT_AGENT_CONFIG)
}

for (const useCaseId of ['fire_smoke', 'flood_watch', 'graffiti', 'landslide_watch', 'slip_hazard', 'post_quake']) {
  test(`person-only detection cannot trigger ${useCaseId}`, () => {
    assert.equal(decision(useCaseId, ['person'], 0).tier, 0)
  })

  test(`person motion cannot masquerade as ${useCaseId}`, () => {
    assert.equal(decision(useCaseId, ['person'], 0.9).tier, 0)
  })
}

test('frame_diff ignores detection-count z-score and uses actual pixel difference', () => {
  assert.equal(decision('landslide_watch', [], 0).tier, 0)
  assert.ok(decision('landslide_watch', [], 0.9).tier > 0)
})

test('parking threshold zero is telemetry-only', () => {
  const result = decision('parking', [])
  assert.equal(result.tier, 0)
  assert.deepEqual(result.actions.map(action => action.name), ['log_tick'])
})
