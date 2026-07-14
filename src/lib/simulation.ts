/**
 * Simulation engine — generates realistic synthetic person counts for demoing
 * the agentic pipeline when real ML detection is impractical (headless browser,
 * slow GPU, video without visible persons).
 *
 * Pattern:
 *   baseline(t) = 10 + 5 * sin(t / 30s)         // slow daily drift 5..15
 *   noise(t)    = randn() * 1.5                  // gaussian noise
 *   surge(t)    = every ~60s, inject a 30s crowd surge of +15..25 persons
 *
 * This produces a realistic-looking time series with both stable periods
 * (for baseline building) and anomaly spikes (for triggering T2/T3 escalation).
 *
 * IMPORTANT: The simulation ONLY generates the person COUNT. Everything
 * downstream — anomaly stats, agent reasoning, action dispatch, alerts,
 * reports — uses the exact same code path as real ML detection. This means
 * the agent layer is genuinely exercised, not faked.
 */

export interface SimulationState {
  startTime: number
  lastTickTime: number
  nextSurgeAt: number
  surgeActiveUntil: number
  surgeMagnitude: number
}

export function createSimulationState(): SimulationState {
  const now = Date.now()
  return {
    startTime: now,
    lastTickTime: now,
    nextSurgeAt: now + 15_000 + Math.random() * 10_000,   // first surge in 15-25s
    surgeActiveUntil: 0,
    surgeMagnitude: 0,
  }
}

/**
 * Generate the next synthetic person count.
 * Call once per agent tick (~1 Hz).
 */
export function nextSimulatedCount(state: SimulationState): number {
  const now = Date.now()
  const elapsedSec = (now - state.startTime) / 1000

  // Slow baseline drift: 6..12 persons (plaza at off-peak)
  const baseline = 9 + 3 * Math.sin(elapsedSec / 45)

  // Gaussian noise (Box-Muller)
  const u1 = Math.random() || 0.0001
  const u2 = Math.random()
  const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * 1.2

  // Crowd surge: SHARP ramp (1-2 ticks), SUSTAIN at peak (12-18 ticks), SHARP fall
  let surge = 0
  if (now >= state.nextSurgeAt && now >= state.surgeActiveUntil) {
    // Start a new surge — sharp onset, sustained peak
    state.surgeActiveUntil = now + 12_000 + Math.random() * 6_000   // 12-18s sustained
    state.surgeMagnitude = 38 + Math.random() * 18                    // +38..56 persons (large enough that z stays >3.5 even as σ catches up)
    state.nextSurgeAt = state.surgeActiveUntil + 25_000 + Math.random() * 20_000  // next in 25-45s
  }
  if (now < state.surgeActiveUntil) {
    // Sharp square-wave surge (not sinusoidal) — onset in 1 tick, sustained at peak
    surge = state.surgeMagnitude
  }

  const count = baseline + noise + surge
  state.lastTickTime = now
  return Math.max(0, Math.round(count))
}

/**
 * Generate synthetic bounding boxes for a given count, for visualization.
 * Boxes are scattered across the canvas area.
 */
export function syntheticBboxes(
  count: number,
  canvasW: number,
  canvasH: number
): Array<{ bbox: [number, number, number, number]; class: string; score: number }> {
  const boxes: Array<{ bbox: [number, number, number, number]; class: string; score: number }> = []
  const aspect = 0.4 // person bbox aspect (h = w * 2.5)
  for (let i = 0; i < count; i++) {
    const w = 30 + Math.random() * 30
    const h = w / aspect
    const x = Math.random() * (canvasW - w)
    const y = canvasH * 0.3 + Math.random() * (canvasH * 0.6 - h)
    boxes.push({
      bbox: [x, y, w, h] as [number, number, number, number],
      class: 'person',
      score: 0.65 + Math.random() * 0.3,
    })
  }
  return boxes
}
