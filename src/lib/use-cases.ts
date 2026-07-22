/**
 * Use Case definitions — commercial + disaster modes.
 *
 * Each use case defines:
 *   - detection classes (which COCO-SSD classes to track)
 *   - the rule logic (threshold, ROI, time gate, frame-diff, etc.)
 *   - the agentic actions to trigger
 *   - the capability level (Traditional / ML-DL / Cognitive / Agentic)
 *   - the disaster flag (for INDECI/SINPAD report compatibility)
 *
 * The agent loop (lib/agent.ts) consumes the active use case and adjusts
 * its reasoning + action dispatch accordingly.
 */

export type CapabilityLevel = 'traditional' | 'mldl' | 'cognitive' | 'agentic'

export interface UseCase {
  id: string
  name: string
  nameEn: string
  category: 'commercial' | 'disaster'
  level: CapabilityLevel
  description: string
  descriptionEn: string
  /** COCO-SSD classes to track for this use case (person, car, backpack, etc.).
   * These are the classes COCO-SSD can actually detect. */
  detectionClasses: string[]
  /** The class label to use when a specialized HF model (not COCO-SSD) detects
   * something. This prevents fire from being mislabeled as 'person'.
   * e.g., fire_smoke → 'fire', graffiti → 'graffiti', flood_watch → 'flood'. */
  specializedClassName?: string
  /** Human-readable name of the primary model used for this use case.
   * Shown in the UI so the user knows which model is running. */
  primaryModel?: string
  /** Rule type — determines how the agent evaluates detections. */
  ruleType: 'count_threshold' | 'roi_breach' | 'time_gate' | 'frame_diff' | 'sustain_verify' | 'density_anomaly'
  /** Rule parameters. */
  params: {
    threshold?: number
    sustainTicks?: number
    roiPolygon?: Array<{ x: number; y: number }> // normalized 0-1
    timeGate?: { after: string; before: string } // "22:00" - "06:00"
    frameDiffThreshold?: number
  }
  /** Actions to trigger when rule fires. */
  actions: string[]
  /** Whether this use case generates INDECI/SINPAD-compatible reports. */
  indeciReport?: boolean
  /** Icon for UI. */
  icon: string
  /** Tier for UI display (derived from actions — highest action tier). */
  tier?: number
  /** Signal description for UI display. */
  signal?: string
  /** Value statement for UI display. */
  value?: string
}

export const USE_CASES: UseCase[] = [
  // ═══ Commercial — Traditional (Level 1) ═══
  {
    id: 'intrusion',
    name: 'Intrusión en Zona Restringida',
    nameEn: 'Restricted Zone Intrusion',
    category: 'commercial',
    level: 'traditional',
    description: 'Detecta cuando una persona o vehículo entra en un ROI definido. Regla determinista — sin ML.',
    descriptionEn: 'Detects when a person or vehicle enters a defined ROI. Deterministic rule — no ML.',
    detectionClasses: ['person', 'car', 'truck'],
    primaryModel: 'COCO-SSD (TF.js)',
    ruleType: 'roi_breach',
    params: { roiPolygon: [{ x: 0.6, y: 0.4 }, { x: 0.9, y: 0.4 }, { x: 0.9, y: 0.8 }, { x: 0.6, y: 0.8 }] },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email'],
    icon: 'shield',
  },
  {
    id: 'after_hours',
    name: 'Intrusión Vehicular Fuera de Horario',
    nameEn: 'After-Hours Vehicle Intrusion',
    category: 'commercial',
    level: 'traditional',
    description: 'Cualquier vehículo detectado después de horario de atención → Tier 2.',
    descriptionEn: 'Any vehicle detected after business hours → Tier 2.',
    detectionClasses: ['car', 'truck', 'bus', 'motorcycle'],
    primaryModel: 'COCO-SSD (TF.js)',
    ruleType: 'time_gate',
    params: { timeGate: { after: '20:00', before: '06:00' }, threshold: 1 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email', 'escalate'],
    icon: 'moon',
  },
  // ═══ Commercial — ML/DL (Level 2) ═══
  {
    id: 'crowd_surge',
    name: 'Avalancha de Multitud',
    nameEn: 'Crowd Surge Detection',
    category: 'commercial',
    level: 'mldl',
    description: 'z-score del conteo de personas vs línea base de 2 min. z>2.5 sostenido → Tier 2.',
    descriptionEn: 'z-score of person count vs 2-min baseline. z>2.5 sustained → Tier 2.',
    detectionClasses: ['person'],
    primaryModel: 'COCO-SSD (TF.js)',
    ruleType: 'density_anomaly',
    params: { threshold: 2.5, sustainTicks: 3 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email'],
    icon: 'users',
  },
  {
    id: 'parking',
    name: 'Estacionamiento — Espacios Disponibles',
    nameEn: 'Parking — Available Spaces',
    category: 'commercial',
    level: 'mldl',
    description: 'Cuenta vehículos en ROI de estacionamiento. Variación = espacios liberados/ocupados.',
    descriptionEn: 'Counts vehicles in parking ROI. Variation = spaces freed/occupied.',
    detectionClasses: ['car', 'truck'],
    primaryModel: 'COCO-SSD (TF.js)',
    ruleType: 'count_threshold',
    params: { threshold: 0, roiPolygon: [{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.9 }] },
    actions: ['log_tick'],
    icon: 'car',
  },
  {
    id: 'queue_anomaly',
    name: 'Anomalía de Cola en Cajeros',
    nameEn: 'ATM Queue Anomaly',
    category: 'commercial',
    level: 'mldl',
    description: 'Detecta colas largas en zona de cajeros. z-score del conteo > 2 → Tier 1.',
    descriptionEn: 'Detects long queues at ATM zone. z-score of count > 2 → Tier 1.',
    detectionClasses: ['person'],
    primaryModel: 'COCO-SSD (TF.js)',
    ruleType: 'density_anomaly',
    params: { threshold: 2.0, sustainTicks: 2 },
    actions: ['badge', 'log_hit'],
    icon: 'list',
  },
  {
    id: 'abandoned_object',
    name: 'Objeto Abandonado',
    nameEn: 'Abandoned Object',
    category: 'commercial',
    level: 'mldl',
    description: 'Objeto estático > 60s sin persona cercana → Tier 2. Usa frame-diff sobre ROI.',
    descriptionEn: 'Static object > 60s without nearby person → Tier 2. Uses frame-diff on ROI.',
    detectionClasses: ['backpack', 'suitcase', 'handbag'],
    primaryModel: 'COCO-SSD (TF.js)',
    specializedClassName: 'abandoned_object',
    ruleType: 'sustain_verify',
    params: { sustainTicks: 5, threshold: 1 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email'],
    icon: 'package',
  },
  {
    id: 'graffiti',
    name: 'Grafiti y Vandalismo',
    nameEn: 'Graffiti & Vandalism',
    category: 'commercial',
    level: 'mldl',
    description: 'Detecta cambios estáticos en fachada después que persona sale del frame. Frame-diff.',
    descriptionEn: 'Detects static changes on façade after person leaves frame. Frame-diff.',
    detectionClasses: ['person'],
    primaryModel: 'CLIP zero-shot (Xenova/clip-vit-base-patch32)',
    specializedClassName: 'graffiti',
    ruleType: 'frame_diff',
    params: { frameDiffThreshold: 0.15 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email'],
    icon: 'spraycan',
  },
  {
    id: 'fire_smoke',
    name: 'Fuego y Humo',
    nameEn: 'Fire & Smoke',
    category: 'commercial',
    level: 'mldl',
    description: 'Detección visual de fuego/humo con verificación de 3 fotogramas consecutivos.',
    descriptionEn: 'Visual fire/smoke detection with 3-consecutive-frame verification.',
    detectionClasses: ['person'],
    primaryModel: 'Fire Detection Engine (prithivMLmods/Fire-Detection-Engine-ONNX)',
    specializedClassName: 'fire',
    ruleType: 'sustain_verify',
    params: { sustainTicks: 3, threshold: 1 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email', 'escalate'],
    icon: 'flame',
  },
  {
    id: 'slip_hazard',
    name: 'Resbalón y Superficie Mojada',
    nameEn: 'Slip & Wet Surface Hazard',
    category: 'commercial',
    level: 'mldl',
    description: 'Detecta líquidos/superficies mojadas en piso. Alerta a mantenimiento.',
    descriptionEn: 'Detects liquids/wet surfaces on floor. Alerts maintenance.',
    detectionClasses: ['person'],
    primaryModel: 'CLIP zero-shot (Xenova/clip-vit-base-patch32)',
    specializedClassName: 'slip_hazard',
    ruleType: 'frame_diff',
    params: { frameDiffThreshold: 0.10 },
    actions: ['badge', 'log_hit'],
    icon: 'alert',
  },
  // ═══ Commercial — Cognitive (Level 3) ═══
  {
    id: 'incident_description',
    name: 'Descripción Automática de Incidentes',
    nameEn: 'Auto Incident Description',
    category: 'commercial',
    level: 'cognitive',
    description: 'LLM describe el incidente en lenguaje natural para el operador.',
    descriptionEn: 'LLM describes the incident in natural language for the operator.',
    detectionClasses: ['person', 'car'],
    primaryModel: 'COCO-SSD + LLM Judge',
    ruleType: 'count_threshold',
    params: { threshold: 1 },
    actions: ['llm_judge', 'log_hit'],
    icon: 'message',
  },
  // ═══ Commercial — Agentic (Level 4) ═══
  {
    id: 'auto_report',
    name: 'Reporte Auto-Generado',
    nameEn: 'Auto-Generated Report',
    category: 'commercial',
    level: 'agentic',
    description: 'Ciclo completo: detecta → razona → actúa → reflexiona. Reporte automático + juez LLM.',
    descriptionEn: 'Full loop: detect → reason → act → reflect. Auto report + LLM judge.',
    detectionClasses: ['person', 'car'],
    primaryModel: 'COCO-SSD + LLM Judge',
    ruleType: 'density_anomaly',
    params: { threshold: 3.0, sustainTicks: 3 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email', 'llm_judge', 'escalate', 'generate_report'],
    icon: 'zap',
  },
  {
    id: 'visual_memory',
    name: 'Memoria Visual — Incidentes Similares',
    nameEn: 'Visual Memory — Similar Incidents',
    category: 'commercial',
    level: 'agentic',
    description: 'Busca incidentes similares en historial. v2 roadmap (CLIP embeddings).',
    descriptionEn: 'Searches similar incidents in history. v2 roadmap (CLIP embeddings).',
    detectionClasses: ['person'],
    primaryModel: 'COCO-SSD + CLIP embeddings',
    ruleType: 'density_anomaly',
    params: { threshold: 2.5, sustainTicks: 3 },
    actions: ['badge', 'snapshot', 'log_hit', 'generate_report'],
    icon: 'brain',
  },
  // ═══ Disaster Modes ═══
  {
    id: 'flood_watch',
    name: 'Vigilancia de Inundación',
    nameEn: 'Continuous Flood Watch',
    category: 'disaster',
    level: 'mldl',
    description: 'Segmentación de agua + medición de nivel. z-score del nivel > 2 → Tier 2 evacuación.',
    descriptionEn: 'Water segmentation + level measurement. z-score of level > 2 → Tier 2 evacuation.',
    detectionClasses: ['person'],
    primaryModel: 'CLIP zero-shot (Xenova/clip-vit-base-patch32)',
    specializedClassName: 'flood',
    ruleType: 'frame_diff',
    params: { frameDiffThreshold: 0.20 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email', 'escalate'],
    indeciReport: true,
    icon: 'droplet',
  },
  {
    id: 'landslide_watch',
    name: 'Vigilancia de Deslizamiento',
    nameEn: 'Terrain Movement Watch',
    category: 'disaster',
    level: 'mldl',
    description: 'Frame-diff + flujo óptico en ROI de ladera. Movimiento > umbral → Tier 2.',
    descriptionEn: 'Frame-diff + optical flow on slope ROI. Movement > threshold → Tier 2.',
    detectionClasses: ['person'],
    primaryModel: 'CLIP zero-shot (Xenova/clip-vit-base-patch32)',
    specializedClassName: 'landslide',
    ruleType: 'frame_diff',
    params: { frameDiffThreshold: 0.25, roiPolygon: [{ x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.7, y: 0.5 }, { x: 0.3, y: 0.5 }] },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email', 'escalate'],
    indeciReport: true,
    icon: 'mountain',
  },
  {
    id: 'post_quake',
    name: 'Escanéo Post-Sismo',
    nameEn: 'Post-Seismic Structural Scan',
    category: 'disaster',
    level: 'agentic',
    description: 'SASPe webhook → modo escaneo. YOLOv11 crack/spall/rebar. Severidad ≥ 3 → INDECI.',
    descriptionEn: 'SASPe webhook → scan mode. YOLOv11 crack/spall/rebar. Severity ≥ 3 → INDECI.',
    detectionClasses: ['person'],
    primaryModel: 'CLIP zero-shot (Xenova/clip-vit-base-patch32)',
    specializedClassName: 'crack',
    ruleType: 'frame_diff',
    params: { frameDiffThreshold: 0.30 },
    actions: ['badge', 'snapshot', 'log_hit', 'send_email', 'escalate', 'generate_report'],
    indeciReport: true,
    icon: 'activity',
  },
]

export const LEVEL_LABELS: Record<CapabilityLevel, { en: string; es: string; color: string }> = {
  traditional: { en: 'Traditional Rules', es: 'Reglas Tradicionales', color: 'A1A1AA' },
  mldl: { en: 'ML / Deep Learning', es: 'ML / Deep Learning', color: '52525B' },
  cognitive: { en: 'Cognitive / GenAI', es: 'Cognitiva / GenAI', color: 'F59E0B' },
  agentic: { en: 'Agentic AI', es: 'IA Autónoma', color: '059669' },
}
