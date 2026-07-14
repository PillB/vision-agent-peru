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
  /** Use case categories this camera is best suited to demonstrate. */
  useCases?: string[]
}

export const CAMERA_SOURCES: CameraSource[] = [
  {
    id: 'intersection',
    label: 'Intersección Urbana — Tráfico y Peatones',
    location: 'Ciudad, Perú',
    src: '/sim/urban-intersection.mp4',
    useCases: ['traffic', 'pedestrians', 'vehicles', 'crowd'],
  },
  {
    id: 'crosswalk',
    label: 'Cruce Peatonal — Multitud',
    location: 'Centro, Perú',
    src: '/sim/urban-crosswalk.mp4',
    useCases: ['pedestrians', 'crowd', 'queue'],
  },
  {
    id: 'street',
    label: 'Calle Comercial — Tráfico',
    location: 'Av. Principal, Perú',
    src: '/sim/urban-street.mp4',
    useCases: ['vehicles', 'pedestrians', 'parking'],
  },
  {
    id: 'pedestrians',
    label: 'Avenida — Peatones y Vehículos',
    location: 'Jr. de la Unión, Perú',
    src: '/sim/urban-pedestrians.mp4',
    useCases: ['pedestrians', 'vehicles', 'flow'],
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
  /** Active use case — determines detection classes, rule type, and actions. */
  activeUseCaseId: string
  /** Active capability level — controls which agentic features are enabled. */
  capabilityLevel: 'traditional' | 'mldl' | 'cognitive' | 'agentic'

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
  setActiveUseCase: (id: string) => void
  setCapabilityLevel: (level: 'traditional' | 'mldl' | 'cognitive' | 'agentic') => void
  pushDetections: (dets: Detection[]) => void
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
  activeUseCaseId: 'crowd_surge',
  capabilityLevel: 'agentic',

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
  setActiveUseCase: (id) => set({
    activeUseCaseId: id,
    samples: [],
    stats: null,
    sustainCount: 0,
    currentTier: 0,
    detections: [],
    personCount: 0,
  }),
  setCapabilityLevel: (level) => set({ capabilityLevel: level }),

  pushDetections: (dets) => {
    // Count all detections (not just persons) — the agent loop filters by
    // useCase.detectionClasses. The anomaly stats track total detection count
    // so that vehicle-heavy use cases (parking, intrusion) also produce z-scores.
    const count = dets.length
    const sample: AnomalySample = { t: Date.now(), count }
    set((state) => {
      const samples = [...state.samples, sample].slice(-MAX_SAMPLES)
      const stats = computeAnomalyStats(samples, state.anomalyConfig)
      // sustain counter: increments when peakZ > t1Z, resets when back to normal
      const wasAnom = stats.peakZ > state.agentConfig.t1Z
      const sustainCount = wasAnom ? state.sustainCount + 1 : 0
      return {
        detections: dets,
        personCount: count,
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
