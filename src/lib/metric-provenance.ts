/**
 * Metric Provenance Catalogue — Vision Agent
 *
 * Every displayed metric is documented here with its full lineage:
 * definition, source, computation, and display location.
 *
 * This file is the single source of truth for metric integrity.
 * The adversarial test suite validates that each metric's displayed
 * value matches its computed value from the documented source.
 */

export interface MetricProvenance {
  metric_id: string
  definition: string
  display_locations: string[]
  unit: string
  numerator: string | null
  denominator: string | null
  aggregation: string
  source_function: string
  source_file: string
  source_line: string
  transformations: string[]
  status: 'verified' | 'failed' | 'not_verified'
}

export const METRIC_PROVENANCE: MetricProvenance[] = [
  {
    metric_id: 'personCount',
    definition: 'Total number of COCO-SSD detections in the current frame (all classes: person, car, backpack, etc.)',
    display_locations: ['metrics-row.tsx (label: "Detections now")', 'camera-view overlay'],
    unit: 'count',
    numerator: 'dets.length (all detections)',
    denominator: null,
    aggregation: 'array length',
    source_function: 'pushDetections',
    source_file: 'src/lib/store.ts',
    source_line: '~425',
    transformations: [
      'COCO-SSD model.detect(canvas, 20) → predictions[]',
      'predictions.map(p => ({bbox, class, score})) → dets[]',
      'dets.length → count',
      'count → personCount (store state)'
    ],
    status: 'verified',
  },
  {
    metric_id: 'zScore',
    definition: 'Z-score of current detection count vs sliding-window mean. Measures how many stddevs the current count is above/below the recent baseline.',
    display_locations: ['metrics-row.tsx (label: "Z-score")', 'agent-trace reasoning'],
    unit: 'standard deviations (σ)',
    numerator: 'count - mean',
    denominator: 'stddev',
    aggregation: '(count - mean) / stddev',
    source_function: 'computeAnomalyStats',
    source_file: 'src/lib/anomaly.ts',
    source_line: '~30',
    transformations: [
      'samples[] → window = last N samples',
      'window.reduce(sum) / window.length → mean',
      'sqrt(sum((count - mean)^2) / N) → stddev',
      'stddev > 0 ? (count - mean) / stddev : 0 → zScore'
    ],
    status: 'verified',
  },
  {
    metric_id: 'mean',
    definition: 'Sliding-window arithmetic mean of detection counts over the last 2 minutes (120 samples at 1 Hz)',
    display_locations: ['metrics-row.tsx (sub: "2-min avg")'],
    unit: 'count',
    numerator: 'sum of all count values in window',
    denominator: 'window.length',
    aggregation: 'arithmetic mean',
    source_function: 'computeAnomalyStats',
    source_file: 'src/lib/anomaly.ts',
    source_line: '~20',
    transformations: [
      'window = samples.slice(-config.windowSize)',
      'sum = window.reduce((acc, s) => acc + s.count, 0)',
      'mean = sum / window.length'
    ],
    status: 'verified',
  },
  {
    metric_id: 'stddev',
    definition: 'Population standard deviation of detection counts in the sliding window',
    display_locations: ['metrics-row.tsx (sub: "σ")'],
    unit: 'count',
    numerator: 'sum of (count - mean)^2',
    denominator: 'window.length',
    aggregation: 'sqrt(variance)',
    source_function: 'computeAnomalyStats',
    source_file: 'src/lib/anomaly.ts',
    source_line: '~25',
    transformations: [
      'variance = sum((count - mean)^2) / N',
      'stddev = sqrt(variance)'
    ],
    status: 'verified',
  },
  {
    metric_id: 'currentTier',
    definition: 'Current alert tier (0=Nominal, 1=Watch, 2=Anomaly, 3=Critical) determined by the agent rule engine',
    display_locations: ['metrics-row.tsx (label: "Tier")', 'camera-view overlay badge', 'agent-trace'],
    unit: 'integer 0-3',
    numerator: null,
    denominator: null,
    aggregation: 'max tier from decide() function',
    source_function: 'decide',
    source_file: 'src/lib/agent.ts',
    source_line: '~114',
    transformations: [
      'ruleTriggered → tier=1',
      'sustainCount >= sustainNeeded && mldl+ → tier=2',
      'sustainCount >= t3Sustain && agentic && !breakerTripped → tier=3'
    ],
    status: 'verified',
  },
  {
    metric_id: 'fps',
    definition: 'Detection frames per second (throttled to ~0.67 Hz in practice)',
    display_locations: ['camera-view.tsx (status bar)'],
    unit: 'Hz (frames/sec)',
    numerator: 'detection cycles completed',
    denominator: 'elapsed seconds',
    aggregation: 'rolling count / elapsed time',
    source_function: 'detect loop (camera-view.tsx)',
    source_file: 'src/components/prototype/camera-view.tsx',
    source_line: '~280',
    transformations: [
      'fpsTick.n += 1 per detect cycle',
      'if (now - fpsTick.t > 1000) fps = round(n * 1000 / elapsed)'
    ],
    status: 'verified',
  },
  {
    metric_id: 'lastDetectionLatencyMs',
    definition: 'Time in milliseconds for the last COCO-SSD inference (drawImage + model.detect)',
    display_locations: ['camera-view.tsx (status bar)'],
    unit: 'milliseconds',
    numerator: 'performance.now() after detect - performance.now() before detect',
    denominator: null,
    aggregation: 'single measurement',
    source_function: 'detect (RealMlLoader)',
    source_file: 'src/components/prototype/real-ml-loader.tsx',
    source_line: '~80',
    transformations: [
      't0 = performance.now()',
      'ctx.drawImage(video/img)',
      'predictions = await model.detect(canvas, 20)',
      'latency = performance.now() - t0'
    ],
    status: 'verified',
  },
  {
    metric_id: 'activeHits',
    definition: 'Number of unacknowledged alert hits (Tier >= 2 incidents)',
    display_locations: ['metrics-row.tsx (label: "Active incidents")'],
    unit: 'count',
    numerator: 'hits.filter(h => !h.acknowledged).length',
    denominator: null,
    aggregation: 'filter + length',
    source_function: 'MetricsRow component',
    source_file: 'src/components/prototype/metrics-row.tsx',
    source_line: '~16',
    transformations: [
      'hits.filter(h => !h.acknowledged) → activeHits[]',
      'activeHits.length → displayed value'
    ],
    status: 'verified',
  },
  {
    metric_id: 'agentCycleCount',
    definition: 'Total number of agent reasoning cycles completed since session start',
    display_locations: ['agent-trace.tsx (cycle counter)'],
    unit: 'count',
    numerator: 'incremented per runAgentLoop call',
    denominator: null,
    aggregation: 'cumulative counter',
    source_function: 'runAgentLoop',
    source_file: 'src/components/prototype/camera-view.tsx',
    source_line: '~110',
    transformations: [
      'agentCycleCount: state.agentCycleCount + 1'
    ],
    status: 'verified',
  },
  {
    metric_id: 'thirty_times_faster',
    definition: 'Marketing claim: "30× faster than manual review" — derived from <2s agentic loop vs ~60s manual review',
    display_locations: ['tab1-overview.tsx (BigStat value="30×")'],
    unit: 'ratio',
    numerator: '~60s manual review time',
    denominator: '~2s agentic loop time',
    aggregation: '60 / 2 = 30',
    source_function: 'static text',
    source_file: 'src/components/tab1-overview.tsx',
    source_line: '~102',
    transformations: ['Static calculation, not dynamically computed'],
    status: 'not_verified',
  },
]

/**
 * Get provenance for a specific metric by ID.
 */
export function getMetricProvenance(metricId: string): MetricProvenance | null {
  return METRIC_PROVENANCE.find(m => m.metric_id === metricId) ?? null
}

/**
 * Get all verified metrics.
 */
export function getVerifiedMetrics(): MetricProvenance[] {
  return METRIC_PROVENANCE.filter(m => m.status === 'verified')
}

/**
 * Get all metrics that are NOT verified (for audit reporting).
 */
export function getUnverifiedMetrics(): MetricProvenance[] {
  return METRIC_PROVENANCE.filter(m => m.status !== 'verified')
}
