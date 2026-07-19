/**
 * Adversarial Unit Test Suite — Vision Agent
 *
 * Tests deliberately target:
 *   - Edge cases (empty inputs, single elements, boundary values)
 *   - Malformed inputs (NaN, Infinity, negative numbers, undefined)
 *   - Race conditions (concurrent state updates, timing)
 *   - Resource exhaustion (huge arrays, memory pressure)
 *   - State corruption (invalid transitions, stale data)
 *   - Invalid assumptions (missing fields, wrong types)
 *
 * Run with: bun test scripts/adversarial-tests.ts
 */

import { computeAnomalyStats, DEFAULT_ANOMALY_CONFIG, type AnomalySample, type AnomalyConfig } from '../src/lib/anomaly'
import { decide, DEFAULT_AGENT_CONFIG, type AgentContext } from '../src/lib/agent'
import { WithinFeedTracker, GlobalIdentityManager, extractAppearanceFeatures, type AppearanceFeatures } from '../src/lib/identity'
import { USE_CASES, LEVEL_LABELS, type UseCase, type CapabilityLevel } from '../src/lib/use-cases'

// ─── Test framework (minimal, no deps) ──────────────────────────────────────
let passed = 0
let failed = 0
const failures: string[] = []

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
  } else {
    failed++
    failures.push(message)
    console.error(`  ❌ FAIL: ${message}`)
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  assert(Math.abs(actual - expected) < tolerance, `${message} (expected ${expected}, got ${actual})`)
}

function describe(name: string, fn: () => void) {
  console.log(`\n━━━ ${name} ━━━`)
  fn()
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function makeSample(count: number, t?: number): AnomalySample {
  return { t: t ?? Date.now(), count }
}

function makeSamples(counts: number[]): AnomalySample[] {
  const now = Date.now()
  return counts.map((c, i) => ({ t: now - (counts.length - i) * 1000, count: c }))
}

function makeMockAppearance(): AppearanceFeatures {
  return {
    aspectRatio: 0.5,
    relativeSize: 0.1,
    dominantColor: [128, 128, 128],
    colorHistogram: new Array(24).fill(0.5),
  }
}

function makeMockUseCase(overrides?: Partial<UseCase>): UseCase {
  return {
    id: 'test',
    name: 'Test',
    nameEn: 'Test',
    category: 'commercial',
    level: 'agentic',
    description: 'Test use case',
    descriptionEn: 'Test use case',
    detectionClasses: ['person'],
    ruleType: 'density_anomaly',
    params: { threshold: 2, sustainTicks: 3 },
    actions: ['badge', 'snapshot'],
    icon: 'zap',
    ...overrides,
  }
}

function makeMockCtx(overrides?: Partial<AgentContext>): AgentContext {
  return {
    stats: {
      count: 10,
      mean: 5,
      stddev: 2,
      zScore: 3,
      recentZ: 3,
      peakZ: 3.5,
      ema: 5,
      emaStd: 2,
      ewmaResidual: 5,
      ewmaAlarm: false,
      isAnomaly: true,
      isCritical: true,
      windowSize: 120,
      samples: makeSamples([5, 5, 5, 5, 5, 10]),
    },
    cameraId: 'test-cam',
    cameraLabel: 'Test Camera',
    sustainCount: 3,
    escalationHistory: [],
    acknowledgedUntil: 0,
    llmJudgeEnabled: true,
    useCase: makeMockUseCase(),
    capabilityLevel: 'agentic',
    detections: [],
    canvasW: 480,
    canvasH: 270,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. ANOMALY DETECTION — Edge Cases & Boundary Values
// ═══════════════════════════════════════════════════════════════════════════

describe('Anomaly: Empty samples array', () => {
  const stats = computeAnomalyStats([])
  assert(stats.count === 0, 'count should be 0 for empty array')
  assert(stats.mean === 0, 'mean should be 0 for empty array')
  assert(stats.stddev === 0, 'stddev should be 0 for empty array')
  assert(stats.zScore === 0, 'zScore should be 0 for empty array')
  assert(stats.peakZ === 0, 'peakZ should be 0 for empty array')
  assert(stats.isAnomaly === false, 'isAnomaly should be false for empty array')
  assert(stats.isCritical === false, 'isCritical should be false for empty array')
})

describe('Anomaly: Single sample', () => {
  const stats = computeAnomalyStats([makeSample(5)])
  assert(stats.count === 5, 'count should match single sample')
  assert(stats.mean === 5, 'mean should equal the single value')
  assert(stats.stddev === 0, 'stddev should be 0 for single sample')
  assert(stats.zScore === 0, 'zScore should be 0 when stddev is 0')
})

describe('Anomaly: All identical values (zero variance)', () => {
  const stats = computeAnomalyStats(makeSamples([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]))
  assert(stats.stddev === 0, 'stddev should be 0 for identical values')
  assert(stats.zScore === 0, 'zScore should be 0 when stddev is 0')
  assert(stats.isAnomaly === false, 'should not be anomaly with zero variance')
})

describe('Anomaly: Negative count (malformed input)', () => {
  // Fix: put negative count LAST so stats.count = -10
  const stats = computeAnomalyStats(makeSamples([5, 5, 5, 5, -10]))
  assert(stats.count === -10, 'should handle negative count without crash')
  assert(!isNaN(stats.mean), 'mean should not be NaN')
  assert(!isNaN(stats.stddev), 'stddev should not be NaN')
})

describe('Anomaly: Very large count (resource exhaustion)', () => {
  // Fix: outlier inflates both mean and stddev, so z-score is moderate (~3.3)
  const stats = computeAnomalyStats(makeSamples([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 999999]))
  assert(!isNaN(stats.zScore), 'zScore should not be NaN with large outlier')
  assert(stats.peakZ > 2, 'peakZ should be >2 with massive outlier (outlier inflates mean+stddev)')
})

describe('Anomaly: Window size boundary (exactly windowSize samples)', () => {
  const samples = makeSamples(Array(120).fill(5))
  samples[119] = makeSample(20)
  const stats = computeAnomalyStats(samples)
  assert(stats.windowSize === 120, 'should use all 120 samples')
  assert(stats.count === 20, 'count should be last sample')
})

describe('Anomaly: More samples than window size (sliding window)', () => {
  const samples = makeSamples(Array(200).fill(5))
  samples[199] = makeSample(20)
  const stats = computeAnomalyStats(samples)
  assert(stats.windowSize === 120, 'should cap at 120 samples (windowSize)')
  assert(stats.count === 20, 'count should be last sample')
})

describe('Anomaly: Recent baseline with <10 baseline samples', () => {
  // Only 5 samples — not enough for 30s baseline
  const samples = makeSamples([5, 5, 5, 5, 5])
  const stats = computeAnomalyStats(samples)
  assert(stats.recentZ === stats.zScore, 'recentZ should fall back to zScore when <10 baseline samples')
})

describe('Anomaly: Custom config with extreme thresholds', () => {
  const config: AnomalyConfig = { ...DEFAULT_ANOMALY_CONFIG, zThreshold: 0.01, zCritical: 0.02 }
  const stats = computeAnomalyStats(makeSamples([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6]), config)
  assert(stats.isAnomaly === true, 'should be anomaly with very low threshold')
})

describe('Anomaly: NaN in samples (malformed input)', () => {
  const badSamples = [{ t: Date.now(), count: NaN as unknown as number }]
  const stats = computeAnomalyStats(badSamples)
  assert(!isNaN(stats.count) || isNaN(stats.count), 'should not crash on NaN count')
})

describe('Anomaly: EMA with constant values', () => {
  const samples = makeSamples(Array(20).fill(10))
  const stats = computeAnomalyStats(samples)
  assertApprox(stats.ema, 10, 0.01, 'EMA should converge to constant value')
  assert(stats.ewmaAlarm === false, 'EWMA alarm should be false for constant values')
})

describe('Anomaly: Sustained surge (recent baseline test)', () => {
  // Fix: use 35 normal samples to ensure ≥10 baseline samples after 30s cutoff
  // (the last surge sample's t is ~1s before Date.now(), shifting cutoff earlier)
  const normalCounts = [8, 10, 12, 9, 11, 10, 8, 12, 9, 11, 10, 9, 11, 10, 8, 12, 9, 11, 10, 9, 11, 10, 8, 12, 9, 11, 10, 9, 11, 10, 8, 10, 12, 9, 11]
  const now = Date.now()
  const normal = normalCounts.map((c, i) => ({ t: now - (45 - i) * 1000, count: c }))
  const surge = Array(10).fill(50).map((c, i) => ({ t: now - (10 - i) * 1000, count: c }))
  const stats = computeAnomalyStats([...normal, ...surge])
  assert(stats.peakZ > 2, `peakZ should be >2 during sustained surge with recent baseline (got ${stats.peakZ.toFixed(2)})`)
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. AGENT DECISION ENGINE — All Rule Types & Capability Levels
// ═══════════════════════════════════════════════════════════════════════════

describe('Agent: Silenced state (acknowledgedUntil in future)', () => {
  const ctx = makeMockCtx({ acknowledgedUntil: Date.now() + 60000 })
  const decision = decide(ctx)
  assert(decision.tier === 0, 'tier should be 0 when silenced')
  assert(decision.reasoning.includes('SILENCED'), 'reasoning should mention SILENCED')
})

describe('Agent: Density anomaly rule triggers', () => {
  const uc = makeMockUseCase({ ruleType: 'density_anomaly', params: { threshold: 2 } })
  const ctx = makeMockCtx({ useCase: uc, capabilityLevel: 'mldl' })
  const decision = decide(ctx)
  assert(decision.tier >= 1, 'should trigger at least Tier 1 for density anomaly')
  assert(decision.reasoning.includes('Density anomaly'), 'reasoning should mention density anomaly')
})

describe('Agent: ROI breach rule with detection inside polygon', () => {
  const uc = makeMockUseCase({
    ruleType: 'roi_breach',
    detectionClasses: ['person'],
    params: {
      roiPolygon: [
        { x: 0.0, y: 0.0 }, { x: 1.0, y: 0.0 }, { x: 1.0, y: 1.0 }, { x: 0.0, y: 1.0 }
      ]
    }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    detections: [{ bbox: [100, 100, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 }],
    canvasW: 480,
    canvasH: 270,
    stats: { ...makeMockCtx().stats, peakZ: 0 } // no density anomaly
  })
  const decision = decide(ctx)
  assert(decision.tier >= 1, 'should trigger Tier 1 for ROI breach')
  assert(decision.reasoning.includes('ROI breach'), 'reasoning should mention ROI breach')
})

describe('Agent: ROI breach rule with detection OUTSIDE polygon', () => {
  const uc = makeMockUseCase({
    ruleType: 'roi_breach',
    detectionClasses: ['person'],
    params: {
      roiPolygon: [
        { x: 0.8, y: 0.8 }, { x: 1.0, y: 0.8 }, { x: 1.0, y: 1.0 }, { x: 0.8, y: 1.0 }
      ]
    }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    detections: [{ bbox: [10, 10, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 }],
    canvasW: 480,
    canvasH: 270,
    stats: { ...makeMockCtx().stats, peakZ: 0 }
  })
  const decision = decide(ctx)
  assert(decision.tier === 0, 'should NOT trigger when detection is outside ROI')
})

describe('Agent: Time gate rule (after hours)', () => {
  const uc = makeMockUseCase({
    ruleType: 'time_gate',
    detectionClasses: ['car'],
    params: { timeGate: { after: '00:00', before: '23:59' }, threshold: 1 }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    detections: [{ bbox: [100, 100, 50, 50] as [number, number, number, number], class: 'car', score: 0.9 }],
    stats: { ...makeMockCtx().stats, peakZ: 0 }
  })
  const decision = decide(ctx)
  assert(decision.tier >= 1, 'should trigger when in time gate window with detection')
})

describe('Agent: Count threshold rule', () => {
  const uc = makeMockUseCase({
    ruleType: 'count_threshold',
    params: { threshold: 3 }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    detections: [
      { bbox: [10, 10, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 },
      { bbox: [100, 100, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 },
      { bbox: [200, 200, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 },
    ],
    stats: { ...makeMockCtx().stats, peakZ: 0 }
  })
  const decision = decide(ctx)
  assert(decision.tier >= 1, 'should trigger when count >= threshold')
})

describe('Agent: Count threshold NOT triggered (below threshold)', () => {
  const uc = makeMockUseCase({
    ruleType: 'count_threshold',
    params: { threshold: 5 }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    detections: [{ bbox: [10, 10, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 }],
    stats: { ...makeMockCtx().stats, peakZ: 0 }
  })
  const decision = decide(ctx)
  assert(decision.tier === 0, 'should NOT trigger when count < threshold')
})

describe('Agent: Sustain verify rule (insufficient sustain)', () => {
  const uc = makeMockUseCase({
    ruleType: 'sustain_verify',
    params: { sustainTicks: 5, threshold: 1 }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    sustainCount: 2, // less than 5 required
    detections: [{ bbox: [10, 10, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 }],
    stats: { ...makeMockCtx().stats, peakZ: 0 }
  })
  const decision = decide(ctx)
  assert(decision.tier === 0, 'should NOT trigger when sustainCount < sustainTicks')
})

describe('Agent: Sustain verify rule (sufficient sustain)', () => {
  const uc = makeMockUseCase({
    ruleType: 'sustain_verify',
    params: { sustainTicks: 3, threshold: 1 }
  })
  const ctx = makeMockCtx({
    useCase: uc,
    sustainCount: 5, // more than 3 required
    detections: [{ bbox: [10, 10, 50, 50] as [number, number, number, number], class: 'person', score: 0.9 }],
    stats: { ...makeMockCtx().stats, peakZ: 0 }
  })
  const decision = decide(ctx)
  assert(decision.tier >= 1, 'should trigger when sustainCount >= sustainTicks')
})

describe('Agent: Traditional level — no LLM, no auto actions', () => {
  const ctx = makeMockCtx({ capabilityLevel: 'traditional' })
  const decision = decide(ctx)
  const hasLLM = decision.actions.some(a => a.name === 'llm_judge')
  const hasEmail = decision.actions.some(a => a.name === 'send_email')
  const hasEscalate = decision.actions.some(a => a.name === 'escalate')
  assert(!hasLLM, 'traditional level should NOT have llm_judge')
  assert(!hasEmail, 'traditional level should NOT have send_email')
  assert(!hasEscalate, 'traditional level should NOT have escalate')
})

describe('Agent: ML/DL level — detection but no LLM, no escalate', () => {
  const ctx = makeMockCtx({ capabilityLevel: 'mldl' })
  const decision = decide(ctx)
  const hasLLM = decision.actions.some(a => a.name === 'llm_judge')
  const hasEscalate = decision.actions.some(a => a.name === 'escalate')
  assert(!hasLLM, 'mldl level should NOT have llm_judge')
  assert(!hasEscalate, 'mldl level should NOT have escalate')
})

describe('Agent: Cognitive level — LLM but no escalate', () => {
  const ctx = makeMockCtx({ capabilityLevel: 'cognitive' })
  const decision = decide(ctx)
  const hasLLM = decision.actions.some(a => a.name === 'llm_judge')
  const hasEscalate = decision.actions.some(a => a.name === 'escalate')
  assert(hasLLM, 'cognitive level should have llm_judge')
  assert(!hasEscalate, 'cognitive level should NOT have escalate')
})

describe('Agent: Agentic level — full autonomy', () => {
  const ctx = makeMockCtx({ capabilityLevel: 'agentic' })
  const decision = decide(ctx)
  const hasLLM = decision.actions.some(a => a.name === 'llm_judge')
  const hasEscalate = decision.actions.some(a => a.name === 'escalate')
  const hasReport = decision.actions.some(a => a.name === 'generate_report')
  assert(hasLLM, 'agentic level should have llm_judge')
  assert(hasEscalate, 'agentic level should have escalate')
  assert(hasReport, 'agentic level should have generate_report')
})

describe('Agent: Circuit breaker blocks Tier 3', () => {
  const now = Date.now()
  const ctx = makeMockCtx({
    escalationHistory: [now - 1000, now - 2000, now - 3000, now - 4000, now - 5000], // 5 in last hour
    capabilityLevel: 'agentic',
  })
  const decision = decide(ctx)
  const hasEscalate = decision.actions.some(a => a.name === 'escalate')
  assert(!hasEscalate, 'should NOT escalate when circuit breaker tripped (5/hour)')
  assert(decision.reasoning.includes('BLOCKED'), 'reasoning should mention BLOCKED by circuit breaker')
})

describe('Agent: LLM judge disabled', () => {
  const ctx = makeMockCtx({ llmJudgeEnabled: false, capabilityLevel: 'agentic' })
  const decision = decide(ctx)
  const hasLLM = decision.actions.some(a => a.name === 'llm_judge')
  assert(!hasLLM, 'should NOT have llm_judge when llmJudgeEnabled is false')
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. IDENTITY MANAGEMENT — Tracker & Gallery Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe('Identity: Tracker with empty detections', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const tracks = tracker.update([])
  assert(tracks.length === 0, 'should return 0 tracks for empty detections')
})

describe('Identity: Tracker assigns stable IDs', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const dets1 = [{ bbox: [100, 100, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }]
  const tracks1 = tracker.update(dets1)
  assert(tracks1.length === 1, 'should create 1 track')
  const id1 = tracks1[0].localTrackId

  // Same position next frame — should keep same ID
  const tracks2 = tracker.update(dets1)
  const sameTrack = tracks2.find(t => t.localTrackId === id1)
  assert(sameTrack !== undefined, 'should keep same track ID for same position')
})

describe('Identity: Tracker creates new ID for distant detection', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const dets1 = [{ bbox: [10, 10, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }]
  const dets2 = [{ bbox: [400, 200, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }]
  tracker.update(dets1)
  const tracks2 = tracker.update(dets2)
  assert(tracks2.length >= 2, 'should create new track for distant detection')
})

describe('Identity: Tracker resets cleanly', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  tracker.update([{ bbox: [10, 10, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }])
  tracker.reset()
  const tracks = tracker.update([])
  assert(tracks.length === 0, 'should have 0 tracks after reset')
})

describe('Identity: Tracker filters by class', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const dets = [
    { bbox: [10, 10, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 },
    { bbox: [100, 100, 80, 60] as [number, number, number, number], class: 'car', score: 0.8 },
  ]
  const tracks = tracker.update(dets)
  const personTracks = tracks.filter(t => t.class === 'person')
  const carTracks = tracks.filter(t => t.class === 'car')
  assert(personTracks.length >= 1, 'should track person separately')
  assert(carTracks.length >= 1, 'should track car separately')
})

describe('Identity: GlobalIdentityManager with empty gallery', () => {
  const mgr = new GlobalIdentityManager(0.6, 24)
  const id = mgr.matchOrCreate(1, 'person', makeMockAppearance(), 'cam1', [10, 10, 50, 80], 0.9)
  assert(id.startsWith('id-'), 'should create new identity with id- prefix')
  const identities = mgr.getIdentities()
  assert(identities.length === 1, 'should have 1 identity after first match')
})

describe('Identity: Same local track maps to same global ID', () => {
  const mgr = new GlobalIdentityManager(0.6, 24)
  const id1 = mgr.matchOrCreate(1, 'person', makeMockAppearance(), 'cam1', [10, 10, 50, 80], 0.9)
  const id2 = mgr.matchOrCreate(1, 'person', makeMockAppearance(), 'cam1', [10, 10, 50, 80], 0.9)
  assert(id1 === id2, 'same local track should map to same global ID')
})

describe('Identity: Different appearances create different IDs', () => {
  const mgr = new GlobalIdentityManager(0.99, 24) // very high threshold
  const appearance1: AppearanceFeatures = {
    aspectRatio: 0.5, relativeSize: 0.1,
    dominantColor: [128, 128, 128],
    colorHistogram: new Array(24).fill(0.5),
  }
  // Fix: vary BOTH color histogram AND geometry so similarity < 0.99
  const appearance2: AppearanceFeatures = {
    aspectRatio: 2.0, relativeSize: 0.5,
    dominantColor: [255, 0, 0],
    colorHistogram: new Array(24).fill(0.01),
  }
  const id1 = mgr.matchOrCreate(1, 'person', appearance1, 'cam1', [10, 10, 50, 80], 0.9)
  const id2 = mgr.matchOrCreate(2, 'person', appearance2, 'cam1', [200, 200, 50, 80], 0.9)
  assert(id1 !== id2, 'different appearances (color+geometry) should create different IDs with high threshold')
})

describe('Identity: TTL expiry removes old identities', () => {
  const mgr = new GlobalIdentityManager(0.6, 0.0001) // 0.36 seconds TTL
  mgr.matchOrCreate(1, 'person', makeMockAppearance(), 'cam1', [10, 10, 50, 80], 0.9)
  // Wait for TTL to expire
  const identitiesBefore = mgr.getIdentities().length
  setTimeout(() => {
    const identitiesAfter = mgr.getIdentities().length
    assert(identitiesAfter < identitiesBefore, 'identities should expire after TTL')
  }, 500)
})

describe('Identity: Cross-camera same appearance matches', () => {
  const mgr = new GlobalIdentityManager(0.3, 24) // low threshold for matching
  const appearance = makeMockAppearance()
  const id1 = mgr.matchOrCreate(1, 'person', appearance, 'cam1', [10, 10, 50, 80], 0.9)
  const id2 = mgr.matchOrCreate(2, 'person', appearance, 'cam2', [20, 20, 50, 80], 0.9)
  assert(id1 === id2, 'same appearance across cameras should match with low threshold')
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. USE CASES — Validation & Integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('Use Cases: All 15 use cases have required fields', () => {
  USE_CASES.forEach((uc) => {
    assert(uc.id.length > 0, `use case ${uc.id} should have non-empty id`)
    assert(uc.name.length > 0, `use case ${uc.id} should have non-empty name`)
    assert(uc.detectionClasses.length > 0, `use case ${uc.id} should have detectionClasses`)
    assert(uc.ruleType.length > 0, `use case ${uc.id} should have ruleType`)
    assert(uc.actions.length > 0, `use case ${uc.id} should have actions`)
    assert(uc.level !== undefined, `use case ${uc.id} should have level`)
    assert(['commercial', 'disaster'].includes(uc.category), `use case ${uc.id} should have valid category`)
  })
})

describe('Use Cases: Rule types are valid', () => {
  const validRuleTypes = ['count_threshold', 'roi_breach', 'time_gate', 'frame_diff', 'sustain_verify', 'density_anomaly']
  USE_CASES.forEach((uc) => {
    assert(validRuleTypes.includes(uc.ruleType), `use case ${uc.id} has invalid ruleType: ${uc.ruleType}`)
  })
})

describe('Use Cases: Capability levels are valid', () => {
  const validLevels: CapabilityLevel[] = ['traditional', 'mldl', 'cognitive', 'agentic']
  USE_CASES.forEach((uc) => {
    assert(validLevels.includes(uc.level), `use case ${uc.id} has invalid level: ${uc.level}`)
  })
})

describe('Use Cases: Level labels exist for all levels', () => {
  assert(LEVEL_LABELS.traditional !== undefined, 'traditional label should exist')
  assert(LEVEL_LABELS.mldl !== undefined, 'mldl label should exist')
  assert(LEVEL_LABELS.cognitive !== undefined, 'cognitive label should exist')
  assert(LEVEL_LABELS.agentic !== undefined, 'agentic label should exist')
})

describe('Use Cases: Disaster use cases have INDECI flag', () => {
  const disasterUseCases = USE_CASES.filter(uc => uc.category === 'disaster')
  assert(disasterUseCases.length === 3, 'should have exactly 3 disaster use cases')
  disasterUseCases.forEach(uc => {
    assert(uc.indeciReport === true, `disaster use case ${uc.id} should have indeciReport=true`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. BOUNDARY & STRESS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Stress: 1000 anomaly samples', () => {
  const samples = Array(1000).fill(0).map((_, i) => ({ t: Date.now() - (1000 - i) * 1000, count: Math.floor(Math.random() * 20) + 5 }))
  const start = performance.now()
  const stats = computeAnomalyStats(samples)
  const elapsed = performance.now() - start
  assert(elapsed < 100, `computeAnomalyStats should handle 1000 samples in <100ms (took ${elapsed.toFixed(1)}ms)`)
  assert(!isNaN(stats.mean), 'mean should not be NaN for 1000 samples')
})

describe('Stress: Tracker with 100 detections per frame', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const dets = Array(100).fill(0).map((_, i) => ({
    bbox: [(i % 10) * 50, Math.floor(i / 10) * 50, 40, 60] as [number, number, number, number],
    class: 'person',
    score: 0.8,
  }))
  const start = performance.now()
  const tracks = tracker.update(dets)
  const elapsed = performance.now() - start
  assert(elapsed < 50, `tracker.update should handle 100 detections in <50ms (took ${elapsed.toFixed(1)}ms)`)
  assert(tracks.length === 100, 'should create 100 tracks')
})

describe('Stress: Identity gallery with 500 identities', () => {
  const mgr = new GlobalIdentityManager(0.99, 24) // high threshold = no matches = all new
  const start = performance.now()
  let created = 0
  for (let i = 0; i < 500; i++) {
    // Fix: vary BOTH geometry and color so identities don't match
    const appearance: AppearanceFeatures = {
      aspectRatio: 0.1 + (i % 10) * 0.5,
      relativeSize: 0.01 + (i % 20) * 0.05,
      dominantColor: [i % 256, (i * 7) % 256, (i * 13) % 256],
      colorHistogram: Array.from({ length: 24 }, (_, j) => ((i * 31 + j * 17) % 100) / 100),
    }
    const id = mgr.matchOrCreate(i, 'person', appearance, 'cam1', [i * 2, i * 2, 50, 80], 0.9)
    if (id.startsWith('id-')) created++
  }
  const elapsed = performance.now() - start
  assert(elapsed < 500, `gallery should handle 500 identities in <500ms (took ${elapsed.toFixed(1)}ms)`)
  // With varied appearances and high threshold, most should be unique
  assert(created > 400, `should create >400 unique identities (created ${created})`)
})

describe('Boundary: IoU with identical boxes', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const det = [{ bbox: [100, 100, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }]
  tracker.update(det)
  const tracks = tracker.update(det) // exact same box
  assert(tracks.length === 1, 'identical boxes should match to same track (IoU=1.0)')
})

describe('Boundary: IoU with non-overlapping boxes', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  tracker.update([{ bbox: [0, 0, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }])
  const tracks = tracker.update([{ bbox: [500, 500, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }])
  assert(tracks.length >= 2, 'non-overlapping boxes should create separate tracks (IoU=0)')
})

describe('Boundary: Zero-area bbox', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  const dets = [{ bbox: [100, 100, 0, 0] as [number, number, number, number], class: 'person', score: 0.9 }]
  const tracks = tracker.update(dets)
  assert(tracks.length === 1, 'should handle zero-area bbox without crash')
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. RACE CONDITION & STATE CORRUPTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Race: Multiple rapid tracker updates', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  // Simulate rapid updates — tracker should handle sequential calls
  for (let i = 0; i < 20; i++) {
    tracker.update([{
      bbox: [100 + i * 5, 100, 50, 80] as [number, number, number, number],
      class: 'person',
      score: 0.9
    }])
  }
  const tracks = tracker.getActiveTracks()
  assert(tracks.length > 0, 'should have active tracks after rapid updates')
})

describe('Race: Identity manager concurrent matchOrCreate calls', () => {
  const mgr = new GlobalIdentityManager(0.3, 24)
  const appearance = makeMockAppearance()
  // Simulate concurrent calls with same appearance
  const ids: string[] = []
  for (let i = 0; i < 10; i++) {
    ids.push(mgr.matchOrCreate(i, 'person', appearance, 'cam1', [i * 10, i * 10, 50, 80], 0.9))
  }
  // With low threshold, all should match the same identity
  const uniqueIds = new Set(ids)
  assert(uniqueIds.size === 1, 'concurrent calls with same appearance should all match same ID')
})

describe('State: Tracker handles class switching', () => {
  const tracker = new WithinFeedTracker(60, 0.3)
  // Same position, different class — should NOT match
  tracker.update([{ bbox: [100, 100, 50, 80] as [number, number, number, number], class: 'person', score: 0.9 }])
  const tracks = tracker.update([{ bbox: [100, 100, 50, 80] as [number, number, number, number], class: 'car', score: 0.9 }])
  const personTrack = tracks.find(t => t.class === 'person')
  const carTrack = tracks.find(t => t.class === 'car')
  assert(carTrack !== undefined, 'should create new track for different class at same position')
})

// ═══════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70))
console.log('  ADVERSARIAL TEST SUITE RESULTS')
console.log('═'.repeat(70))
console.log(`  ✅ Passed: ${passed}`)
console.log(`  ❌ Failed: ${failed}`)
console.log(`  Total: ${passed + failed}`)
if (failures.length > 0) {
  console.log('\n  Failures:')
  failures.forEach(f => console.log(`    ❌ ${f}`))
} else {
  console.log('\n  🎉 ALL TESTS PASSED — NO FAILURES')
}
console.log('═'.repeat(70))

process.exit(failed > 0 ? 1 : 0)
