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
import { USE_CASES } from './use-cases'

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
  /** Use case IDs this camera is best suited to demonstrate. */
  useCases?: string[]
  /** Category for grouping in the UI. */
  category: 'urban' | 'usecase'
  /** When true, src is a static JPEG (not a video). Used for environments
   * where video decoding is unreliable (e.g., headless Chromium with
   * software GL). The camera-view draws the image to canvas once per
   * detect cycle instead of relying on video.currentTime. */
  isStatic?: boolean
}

export const CAMERA_SOURCES: CameraSource[] = [
  // ─── Urban Traffic Feeds (general purpose) ───
  {
    id: 'intersection',
    label: 'Intersección Urbana — Tráfico y Peatones',
    location: 'Ciudad, Perú',
    src: '/sim/urban-intersection.mp4',
    useCases: ['crowd_surge', 'incident_description', 'auto_report', 'visual_memory', 'intrusion'],
    category: 'urban',
  },
  {
    id: 'crosswalk',
    label: 'Cruce Peatonal — Multitud',
    location: 'Centro, Perú',
    src: '/sim/urban-crosswalk.mp4',
    useCases: ['crowd_surge', 'queue_anomaly', 'incident_description'],
    category: 'urban',
  },
  {
    id: 'street',
    label: 'Calle Comercial — Tráfico',
    location: 'Av. Principal, Perú',
    src: '/sim/urban-street.mp4',
    useCases: ['parking', 'after_hours', 'intrusion'],
    category: 'urban',
  },
  {
    id: 'pedestrians',
    label: 'Avenida — Peatones y Vehículos',
    location: 'Jr. de la Unión, Perú',
    src: '/sim/urban-pedestrians.mp4',
    useCases: ['visual_memory', 'intrusion', 'auto_report'],
    category: 'urban',
  },
  // ─── Use Case Specific Feeds ───
  {
    id: 'uc-graffiti',
    label: 'Grafiti — Vandalismo con Spray',
    location: 'Muro urbano, Perú',
    src: '/sim/uc-graffiti.mp4',
    useCases: ['graffiti'],
    category: 'usecase',
  },
  {
    id: 'uc-fire',
    label: 'Fuego y Humo — Fogata al Aire Libre',
    location: 'Exterior, Perú',
    src: '/sim/uc-fire.mp4',
    useCases: ['fire_smoke'],
    category: 'usecase',
  },
  {
    id: 'uc-parking',
    label: 'Estacionamiento — Autos Estacionados',
    location: 'Parking, Perú',
    src: '/sim/uc-parking-lot.mp4',
    useCases: ['parking'],
    category: 'usecase',
  },
  {
    id: 'uc-night-parking',
    label: 'Estacionamiento Nocturno — Auto Sospechoso',
    location: 'Parking nocturno, Perú',
    src: '/sim/uc-night-driving.mp4',
    useCases: ['after_hours', 'intrusion'],
    category: 'usecase',
  },
  {
    id: 'uc-queue',
    label: 'Cola — Personas Esperando en Fila',
    location: 'Acceso, Perú',
    src: '/sim/uc-queue.mp4',
    useCases: ['queue_anomaly'],
    category: 'usecase',
  },
  {
    id: 'uc-backpack',
    label: 'Objeto Abandonado — Persona con Mochila',
    location: 'Vía urbana, Perú',
    src: '/sim/uc-backpack.mp4',
    useCases: ['abandoned_object'],
    category: 'usecase',
  },
  {
    id: 'uc-flood',
    label: 'Inundación — Lluvia Torrencial',
    location: 'Vía inundada, Perú',
    src: '/sim/uc-flood.mp4',
    useCases: ['flood_watch', 'landslide_watch', 'slip_hazard'],
    category: 'usecase',
  },
  {
    id: 'uc-foggy-night',
    label: 'Calle Nebulosa Nocturna — Vehículo',
    location: 'Calle nocturna, Perú',
    src: '/sim/uc-foggy-night.mp4',
    useCases: ['after_hours', 'intrusion'],
    category: 'usecase',
  },
  {
    id: 'uc-demolished',
    label: 'Edificio Dañado — Estructura Post-Sismo',
    location: 'Edificio, Perú',
    src: '/sim/uc-demolished.mp4',
    useCases: ['post_quake'],
    category: 'usecase',
  },
  {
    id: 'uc-crack',
    label: 'Grieta en Concreto — Daño Estructural',
    location: 'Muro de concreto, Perú',
    src: '/sim/uc-crack.mp4',
    useCases: ['post_quake'],
    category: 'usecase',
  },
  // ─── Static-frame cameras (for environments without video decode) ───
  // Pre-extracted JPEG frames from the corresponding .mp4 files. Used as
  // fallback when headless Chromium can't decode video frames to canvas.
  // Tagged with isStatic:true so camera-view knows to use Image instead of video.
  {
    id: 'static-fire',
    label: '[Static] Fuego y Humo',
    location: 'Exterior, Perú (frame)',
    src: '/sim/frames/uc-fire.jpg',
    useCases: ['fire_smoke'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-graffiti',
    label: '[Static] Grafiti',
    location: 'Muro urbano, Perú (frame)',
    src: '/sim/frames/uc-graffiti.jpg',
    useCases: ['graffiti'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-flood',
    label: '[Static] Inundación',
    location: 'Calle inundada, Perú (frame)',
    src: '/sim/frames/uc-flood.jpg',
    useCases: ['flood_watch'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-crack',
    label: '[Static] Grieta',
    location: 'Concreto, Perú (frame)',
    src: '/sim/frames/uc-crack.jpg',
    useCases: ['post_quake'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-demolished',
    label: '[Static] Escombros',
    location: 'Terreno, Perú (frame)',
    src: '/sim/frames/uc-demolished.jpg',
    useCases: ['landslide_watch', 'post_quake'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-foggy-night',
    label: '[Static] Noche Niebla',
    location: 'Exterior, Perú (frame)',
    src: '/sim/frames/uc-foggy-night.jpg',
    useCases: ['slip_hazard'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-backpack',
    label: '[Static] Mochila',
    location: 'Estación, Perú (frame)',
    src: '/sim/frames/uc-backpack.jpg',
    useCases: ['abandoned_object'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-parking',
    label: '[Static] Estacionamiento',
    location: 'Parqueo, Perú (frame)',
    src: '/sim/frames/uc-parking.jpg',
    useCases: ['parking'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-queue',
    label: '[Static] Cola',
    location: 'Cajero, Perú (frame)',
    src: '/sim/frames/uc-queue.jpg',
    useCases: ['queue_anomaly'],
    category: 'usecase',
    isStatic: true,
  },
  {
    id: 'static-intersection',
    label: '[Static] Intersección',
    location: 'Ciudad, Perú (frame)',
    src: '/sim/frames/urban-intersection.jpg',
    useCases: ['crowd_surge', 'incident_description', 'auto_report', 'visual_memory', 'intrusion'],
    category: 'urban',
    isStatic: true,
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

  // Identity tracking
  trackedIdentities: Array<{
    globalId: string
    type: 'person' | 'vehicle'
    firstSeen: number
    lastSeen: number
    observations: number
    plateString?: string
    dominantColor: [number, number, number]
  }>

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
  setTrackedIdentities: (identities: PrototypeState['trackedIdentities']) => void
}

const MAX_SAMPLES = 600    // 10 min at 1 fps
const MAX_HITS = 50
const MAX_ACTIONS = 200
const MAX_TRACE = 50

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
  trackedIdentities: [],

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
      // sustain counter: increments when peakZ > t1Z, resets when back to normal.
      // NOTE: For sustain_verify AND frame_diff use cases, the camera-view's
      // runAgentLoop manages sustainCount directly (based on detection
      // presence, not z-score). To avoid pushDetections overwriting that
      // value, we only update sustainCount here when peakZ actually crossed
      // the t1Z threshold OR when the use case uses density_anomaly /
      // count_threshold / roi_breach / time_gate (z-score-based rules).
      // For sustain_verify and frame_diff use cases, preserve the existing
      // sustainCount — camera-view will update it.
      const activeUseCase = USE_CASES.find((uc) => uc.id === state.activeUseCaseId)
      const usesDetectionBasedSustain = activeUseCase?.ruleType === 'sustain_verify' || activeUseCase?.ruleType === 'frame_diff'
      const wasAnom = stats.peakZ > state.agentConfig.t1Z
      const sustainCount = usesDetectionBasedSustain
        ? state.sustainCount  // preserve — camera-view manages it
        : (wasAnom ? state.sustainCount + 1 : 0)
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

  setTrackedIdentities: (identities) => set({ trackedIdentities: identities }),
}))

// ─── Dev-only global hook for Playwright tests ───
// Exposes the store's getState/setState on `window.__visionStore` so automated
// tests can drive state transitions (use case / camera / capability switches)
// without going through slow radix-Select UI clicks. In production builds this
// code still runs but `window` is undefined on the server, so the guard is
// required.
if (typeof window !== 'undefined') {
  // @ts-expect-error — augmenting window for dev tooling
  window.__visionStore = {
    getState: usePrototypeStore.getState,
    setState: usePrototypeStore.setState,
    subscribe: usePrototypeStore.subscribe,
    // Convenience helpers — these replicate the React component's logic so
    // tests get the same side-effects (camera auto-switch, capability level
    // sync) without going through the UI.
    setActiveUseCase: (id: string) => {
      const store = usePrototypeStore.getState()
      store.setActiveUseCase(id)
      // Sync capability level to the use case's level
      // (mirrors UseCaseSelector.tsx behavior)
      const uc = (window as any).__USE_CASES__?.find((u: any) => u.id === id)
      if (uc?.level) store.setCapabilityLevel(uc.level)
      // Auto-switch to the best camera for this use case
      const cams = (window as any).__CAMERA_SOURCES__ as any[] | undefined
      if (cams) {
        const bestCam = cams.find(c => c.useCases?.includes(id))
        if (bestCam) store.setActiveCamera(bestCam.id)
      }
    },
    setActiveCamera: (id: string) => usePrototypeStore.getState().setActiveCamera(id),
    setCapabilityLevel: (lvl: string) => usePrototypeStore.getState().setCapabilityLevel(lvl as any),
    setRunning: (r: boolean) => usePrototypeStore.getState().setRunning(r),
    setLlmJudgeEnabled: (b: boolean) => usePrototypeStore.getState().setLlmJudgeEnabled(b),
  };
}
