/**
 * Anomaly detection — sliding-window statistics for streaming person counts.
 *
 * Two complementary estimators:
 *   1) Z-score over a fixed sliding window (default 120 samples = 2 minutes at 1 fps)
 *      → robust mean+stddev, intuitive threshold (z > 2 = anomaly)
 *   2) EMA + online variance (EWMA control chart)
 *      → fast reaction to drift, exponentially weighted
 *
 * Both run client-side. The agent layer (see agent.ts) consumes the outputs and
 * decides whether to escalate.
 */

export interface AnomalySample {
  t: number          // epoch ms
  count: number      // persons detected in this tick
}

export interface AnomalyStats {
  count: number              // current person count
  mean: number               // sliding-window mean
  stddev: number             // sliding-window stddev
  zScore: number             // (count - mean) / stddev — raw, inflated during surges
  recentZ: number            // z vs recent baseline (excludes last 5 samples) — robust
  peakZ: number              // max recentZ over last 3 samples — for tier determination
  ema: number                // exponentially-weighted mean
  emaStd: number             // EWMA online stddev
  ewmaResidual: number       // count - ema
  ewmaAlarm: boolean         // |residual| > k * emaStd
  isAnomaly: boolean         // recentZ > threshold (default 2)
  isCritical: boolean        // recentZ > criticalThreshold (default 3.5)
  windowSize: number         // current samples in window
  samples: AnomalySample[]   // sliding window (for charts)
}

export interface AnomalyConfig {
  windowSize: number         // sliding window length (samples)
  zThreshold: number         // anomaly z-score threshold (default 2)
  zCritical: number          // critical z-score threshold (default 3.5)
  emaAlpha: number           // EMA smoothing factor (default 0.1)
  ewmaK: number              // EWMA control chart k factor (default 3)
}

export const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  windowSize: 120,   // 2 minutes at 1 fps
  zThreshold: 2,
  zCritical: 3.5,
  emaAlpha: 0.1,
  ewmaK: 3,
}

/**
 * Compute anomaly stats from a sliding window of person counts.
 * Pure function — no side effects. Suitable for useReducer / zustand selectors.
 */
export function computeAnomalyStats(
  samples: AnomalySample[],
  config: AnomalyConfig = DEFAULT_ANOMALY_CONFIG
): AnomalyStats {
  const window = samples.slice(-config.windowSize)
  const count = window.length > 0 ? window[window.length - 1].count : 0
  const now = window.length > 0 ? window[window.length - 1].t : Date.now()

  // Sliding-window mean & stddev
  let mean = 0
  let stddev = 0
  if (window.length > 0) {
    const sum = window.reduce((acc, s) => acc + s.count, 0)
    mean = sum / window.length
    const variance =
      window.reduce((acc, s) => acc + Math.pow(s.count - mean, 2), 0) /
      window.length
    stddev = Math.sqrt(variance)
  }

  const zScore = stddev > 0 ? (count - mean) / stddev : 0

  // "Recent baseline" — mean+stddev of samples OLDER than 30 seconds.
  // This makes the z-score robust to sustained surges: surge samples are always
  // "recent" so they never contaminate the baseline. The baseline naturally
  // adapts to slow drift (over minutes) but is immune to short-term spikes.
  let recentMean = mean
  let recentStd = stddev
  let recentZ = zScore
  const cutoff = now - 30_000  // 30 seconds ago
  const baselineSamples = window.filter((s) => s.t < cutoff)
  if (baselineSamples.length >= 10) {
    const rMean = baselineSamples.reduce((a, s) => a + s.count, 0) / baselineSamples.length
    const rVar = baselineSamples.reduce((a, s) => a + (s.count - rMean) ** 2, 0) / baselineSamples.length
    const rStd = Math.sqrt(rVar)
    recentMean = rMean
    recentStd = rStd
    recentZ = rStd > 0 ? (count - rMean) / rStd : 0
  }

  // Peak z-score over last 3 samples (using recent baseline) — robust tier determination
  let peakZ = recentZ
  if (window.length >= 2) {
    const recent = window.slice(-3)
    const zs: number[] = []
    for (const s of recent) {
      if (recentStd > 0) zs.push((s.count - recentMean) / recentStd)
    }
    if (zs.length > 0) peakZ = Math.max(...zs)
  }

  // EMA + online variance (EWMA control chart)
  let ema = count
  let emaStd = 0
  if (window.length > 1) {
    const alpha = config.emaAlpha
    let prevEma = window[0].count
    let prevVar = 0
    for (let i = 1; i < window.length; i++) {
      const x = window[i].count
      const residual = x - prevEma
      ema = alpha * x + (1 - alpha) * prevEma
      prevVar = alpha * residual * residual + (1 - alpha) * prevVar
      prevEma = ema
    }
    emaStd = Math.sqrt(prevVar)
  }
  const ewmaResidual = count - ema
  const ewmaAlarm =
    emaStd > 0 && Math.abs(ewmaResidual) > config.ewmaK * emaStd

  return {
    count,
    mean,
    stddev,
    zScore: recentZ,        // expose recentZ as the primary zScore (used by UI + agent)
    recentZ,
    peakZ,
    ema,
    emaStd,
    ewmaResidual,
    ewmaAlarm,
    isAnomaly: recentZ > config.zThreshold && window.length >= 10,
    isCritical: recentZ > config.zCritical && window.length >= 10,
    windowSize: window.length,
    samples: window,
  }
}
