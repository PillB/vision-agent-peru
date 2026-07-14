/**
 * Zustand store for the prototype tab.
 *
 * Holds the live state: detection samples, anomaly stats, alerts/hits log,
 * action audit trail, agent config, and LLM judge results. UI components
 * subscribe to slices; the camera-view component pushes detections in; the
 * agent engine consumes the slice and dispatches actions.
 */

import { create } from 'zustand'
import type { AnomalySample, AnomalyStats, AnomalyConfig } from './anomaly'
import { computeAnomalyStats, DEFAULT_ANOMALY_CONFIG } from './anomaly'
import type { Action, Tier, AgentConfig } from './agent'
import { DEFAULT_AGENT_CONFIG } from './agent'

export interface Detection {
  bbox: [number, number, number, number]  // [x, y, w, h] in source pixels
  class: string
  score: number
}

export interface AlertHit {
  id: string
  timestamp: number
  tier: Tier
  cameraId: string
  cameraLabel: string
  count: number
  zScore: number
  mean: number
  stddev: number
  reasoning: string
  snapshotDataUrl?: string
  acknowledged: boolean
}

export interface ActionLogEntry {
  id: string
  timestamp: number
  action: Action
  status: 'pending' | 'success' | 'failed' | 'skipped'
  message?: string
}

export interface IncidentReport {
  id: string
  createdAt: number
  cameraId: string
  cameraLabel: string
  windowStart: number
  windowEnd: number
  peakCount: number
  peakZScore: number
  tier: Tier
  hitIds: string[]
  summary: string
  llmVerdict?: { verdict: string; confidence: number; reason: string }
}

export interface CameraSource {
  id: string
  label: string
  location: string
  src: string
  poster?: string
}

export const CAMERA_SOURCES: CameraSource[] = [
  {
    id: 'cusco',
    label: 'Cusco — Plaza de Armas',
    location: 'Cusco, Peru',
    src: '/sim/cusco.mp4',
  },
  {
    id: 'lima',
    label: 'Lima — Jirón de la Unión',
    location: 'Lima, Peru',
    src: '/sim/lima.mp4',
  },
  {
    id: 'arequipa',
    label: 'Arequipa — Plaza Mayor',
    location: 'Arequipa, Peru',
    src: '/sim/arequipa.mp4',
  },
]

interface PrototypeState {
  // Camera / model
  activeCameraId: string
  modelStatus: 'idle' | 'loading' | 'ready' | 'error'
  modelError: string | null
  isRunning: boolean
  fps: number
  lastDetectionLatencyMs: number
  /** Real ML mode runs COCO-SSD on video frames. Simulation mode generates
   *  synthetic person counts (with realistic crowd surges) so the agent
   *  pipeline can be demoed in any environment — including headless
   *  browsers without GPU acceleration. */
  detectionMode: 'real' | 'simulation'

  // Detections (current frame)
  detections: Detection[]
  personCount: number

  // Sliding window + anomaly stats
  samples: AnomalySample[]
  stats: AnomalyStats | null
  anomalyConfig: AnomalyConfig

  // Agent
  agentConfig: AgentConfig
  sustainCount: number
  currentTier: Tier
  agentReasoning: string
  agentCycleCount: number
  llmJudgeEnabled: boolean
  acknowledgedUntil: number
  escalationHistory: number[]

  // Logs
  hits: AlertHit[]
  actionLog: ActionLogEntry[]
  reports: IncidentReport[]
  agentTrace: string[]   // last N reasoning strings

  // Actions
  setActiveCamera: (id: string) => void
  setModelStatus: (s: PrototypeState['modelStatus'], err?: string | null) => void
  setRunning: (r: boolean) => void
  setFps: (f: number) => void
  setLatency: (ms: number) => void
  setDetectionMode: (m: 'real' | 'simulation') => void
  pushDetections: (dets: Detection[]) => void
  /** Simulation-mode path: push a synthetic count directly, skipping ML. */
  pushSimulatedCount: (count: number) => void
  clearSamples: () => void
  setAnomalyConfig: (c: Partial<AnomalyConfig>) => void
  setAgentConfig: (c: Partial<AgentConfig>) => void
  setLlmJudgeEnabled: (b: boolean) => void
  acknowledge: (minutes: number) => void
  pushHit: (hit: AlertHit) => void
  acknowledgeHit: (id: string) => void
  pushAction: (entry: ActionLogEntry) => void
  updateAction: (id: string, patch: Partial<ActionLogEntry>) => void
  pushReport: (r: IncidentReport) => void
  setAgentState: (patch: {
    sustainCount?: number
    currentTier?: Tier
    agentReasoning?: string
    agentCycleCount?: number
    escalationHistory?: number[]
  }) => void
  pushTrace: (line: string) => void
}

const MAX_SAMPLES = 600    // 10 min at 1 fps
const MAX_HITS = 50
const MAX_ACTIONS = 200
const MAX_TRACE = 30

export const usePrototypeStore = create<PrototypeState>((set) => ({
  activeCameraId: CAMERA_SOURCES[0].id,
  modelStatus: 'idle',
  modelError: null,
  isRunning: false,
  fps: 0,
  lastDetectionLatencyMs: 0,
  detectionMode: 'real',   // default to real ML (COCO-SSD on real video frames)

  detections: [],
  personCount: 0,

  samples: [],
  stats: null,
  anomalyConfig: DEFAULT_ANOMALY_CONFIG,

  agentConfig: DEFAULT_AGENT_CONFIG,
  sustainCount: 0,
  currentTier: 0,
  agentReasoning: 'Agent idle.',
  agentCycleCount: 0,
  llmJudgeEnabled: true,
  acknowledgedUntil: 0,
  escalationHistory: [],

  hits: [],
  actionLog: [],
  reports: [],
  agentTrace: [],

  setActiveCamera: (id) => set({ activeCameraId: id, samples: [], stats: null, sustainCount: 0, currentTier: 0 }),
  setModelStatus: (s, err = null) => set({ modelStatus: s, modelError: err }),
  setRunning: (r) => set({ isRunning: r }),
  setFps: (f) => set({ fps: f }),
  setLatency: (ms) => set({ lastDetectionLatencyMs: ms }),
  setDetectionMode: (m) => set({
    detectionMode: m,
    samples: [],
    stats: null,
    sustainCount: 0,
    currentTier: 0,
    detections: [],
    personCount: 0,
  }),

  pushDetections: (dets) => {
    const persons = dets.filter((d) => d.class === 'person')
    const count = persons.length
    const sample: AnomalySample = { t: Date.now(), count }
    set((state) => {
      const samples = [...state.samples, sample].slice(-MAX_SAMPLES)
      const stats = computeAnomalyStats(samples, state.anomalyConfig)
      // sustain counter: increments when peakZ > t1Z, resets when back to normal
      const wasAnom = stats.peakZ > state.agentConfig.t1Z
      const sustainCount = wasAnom ? state.sustainCount + 1 : 0
      return {
        detections: persons,
        personCount: count,
        samples,
        stats,
        sustainCount,
      }
    })
  },

  pushSimulatedCount: (count) => {
    const sample: AnomalySample = { t: Date.now(), count: Math.max(0, Math.round(count)) }
    set((state) => {
      const samples = [...state.samples, sample].slice(-MAX_SAMPLES)
      const stats = computeAnomalyStats(samples, state.anomalyConfig)
      const wasAnom = stats.peakZ > state.agentConfig.t1Z
      const sustainCount = wasAnom ? state.sustainCount + 1 : 0
      // In simulation mode we don't have real bboxes; clear detections
      return {
        detections: [],
        personCount: sample.count,
        samples,
        stats,
        sustainCount,
      }
    })
  },

  clearSamples: () => set({ samples: [], stats: null, sustainCount: 0, currentTier: 0, detections: [], personCount: 0 }),

  setAnomalyConfig: (c) =>
    set((state) => {
      const anomalyConfig = { ...state.anomalyConfig, ...c }
      const stats = computeAnomalyStats(state.samples, anomalyConfig)
      return { anomalyConfig, stats }
    }),

  setAgentConfig: (c) => set((state) => ({ agentConfig: { ...state.agentConfig, ...c } })),

  setLlmJudgeEnabled: (b) => set({ llmJudgeEnabled: b }),

  acknowledge: (minutes) => set({ acknowledgedUntil: Date.now() + minutes * 60_000 }),

  pushHit: (hit) =>
    set((state) => ({ hits: [hit, ...state.hits].slice(0, MAX_HITS) })),

  acknowledgeHit: (id) =>
    set((state) => ({
      hits: state.hits.map((h) => (h.id === id ? { ...h, acknowledged: true } : h)),
    })),

  pushAction: (entry) =>
    set((state) => ({ actionLog: [entry, ...state.actionLog].slice(0, MAX_ACTIONS) })),

  updateAction: (id, patch) =>
    set((state) => ({
      actionLog: state.actionLog.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  pushReport: (r) =>
    set((state) => ({ reports: [r, ...state.reports].slice(0, 30) })),

  setAgentState: (patch) => set((state) => ({ ...state, ...patch })),

  pushTrace: (line) =>
    set((state) => {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
      return { agentTrace: [`[${ts}] ${line}`, ...state.agentTrace].slice(0, MAX_TRACE) }
    }),
}))
