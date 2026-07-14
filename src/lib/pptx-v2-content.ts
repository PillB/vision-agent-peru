/**
 * V2 PPTX content — Peruvian Spanish (es-PE) and English (en).
 *
 * Every era column has:
 *   - stage label, name, color
 *   - explanatory paragraph (2-3 sentences, McKinsey-dense)
 *   - 5-8 use cases (commercial + disaster where applicable)
 *
 * No dates, no monetary figures anywhere.
 *
 * Architectural continuity emphasized: same Stage 1-5 pipeline, immutable
 * ActionLog, circuit-breaker, LLM-as-judge, zero-backend, INDECI/SINPAD-
 * compatible reports.
 */

export interface EraContent {
  stage: string
  name: string
  color: string // hex
  def: string
  useCases: string[]
}

export const ERAS_ES: EraContent[] = [
  {
    stage: 'ETAPA 1',
    name: 'Programas Estáticos',
    color: 'A1A1AA',
    def: 'Los humanos codifican reglas; el sistema ejecuta lógica determinista. Cada decisión es auditable porque un humano escribió cada regla. Sin aprendizaje ni adaptación.',
    useCases: [
      'Conteo de personas y vehículos',
      'Detección de intrusión en zonas',
      'Monitoreo de colas en accesos',
      'Disponibilidad de estacionamiento',
      'Dwell time en bahías de carga',
    ],
  },
  {
    stage: 'ETAPA 2',
    name: 'ML / Deep Learning',
    color: '52525B',
    def: 'Los modelos aprenden patrones de los datos. Ningún humano escribe las reglas — el modelo las descubre. Percepción a escala: clasificación, detección de anomalías, reconocimiento de patrones.',
    useCases: [
      'Grafiti y vandalismo en fachadas',
      'Objetos abandonados o sospechosos',
      'Fuego y humo (verificación 3 fotogramas)',
      'Resbalones y superficies mojadas',
      'Intrusión vehicular fuera de horario',
      'Perímetro térmico nocturno',
      'Inteligencia de negocio (conversión)',
      'Inundación: YOLOv8n-seg polígono de agua',
      'Deslizamiento: frame-diff + flujo óptico RAFT',
    ],
  },
  {
    stage: 'ETAPA 3',
    name: 'IA Cognitiva / Generativa',
    color: 'F59E0B',
    def: 'Modelos que sintetizan nuevo contenido — texto, código, imágenes. Asistentes que resumen, traducen y responden preguntas, pero no pueden actuar en el mundo ni perseguir objetivos multi-paso.',
    useCases: [
      'Descripción automática de incidentes',
      'Resumen de eventos del día',
      'Traducción multilingüe de reportes',
      'Clasificación de severidad por lenguaje',
      'Consultas en lenguaje natural sobre video',
      'Descripción de extensión de inundación',
      'Clasificación de severidad de grietas',
    ],
  },
  {
    stage: 'ETAPA 4',
    name: 'IA Autónoma',
    color: '059669',
    def: 'Sistemas que perciben, razonan, actúan y se autocorrigen en un ciclo. Planifican flujos multi-paso, usan herramientas y revisan el curso. De la asistencia a la ejecución de extremo a extremo con gobernanza humana.',
    useCases: [
      'Reporte de incidente auto-generado',
      'Escalada con juez LLM (filtra falsos positivos)',
      'Memoria visual: incidentes similares',
      'Malla multicámara con re-identificación',
      'Daño estructural post-sismo (YOLOv11)',
      'Respuesta coordinada a desastres',
      'Escalada a INDECI/SINPAD con reporte',
      'Webhook SASPe → modo escaneo post-sismo',
    ],
  },
]

export const ERAS_EN: EraContent[] = [
  {
    stage: 'STAGE 1',
    name: 'Static Programs',
    color: 'A1A1AA',
    def: 'Humans encode rules; the system executes deterministic logic. Every decision is auditable because a human wrote each rule. No learning or adaptation.',
    useCases: [
      'People & vehicle counting',
      'Zone intrusion detection',
      'Queue monitoring at entrances',
      'Parking availability',
      'Loading bay dwell time',
    ],
  },
  {
    stage: 'STAGE 2',
    name: 'ML / Deep Learning',
    color: '52525B',
    def: 'Models learn patterns from data. No human writes the rules — the model discovers them. Perception at scale: classification, anomaly detection, pattern recognition.',
    useCases: [
      'Graffiti & façade vandalism',
      'Abandoned/suspicious objects',
      'Fire & smoke (3-frame verification)',
      'Slip & wet surface hazards',
      'After-hours vehicle intrusion',
      'Night thermal perimeter',
      'Business intelligence (conversion)',
      'Flood: YOLOv8n-seg water polygon',
      'Landslide: frame-diff + RAFT optical flow',
    ],
  },
  {
    stage: 'STAGE 3',
    name: 'Cognitive / Generative AI',
    color: 'F59E0B',
    def: 'Models that synthesize new content — text, code, images. Assistants that summarize, translate, and answer questions, but cannot act in the world or pursue multi-step goals.',
    useCases: [
      'Auto incident description',
      'Daily event summarization',
      'Multilingual report translation',
      'Severity classification by language',
      'Natural language video queries',
      'Flood extent description',
      'Crack severity classification',
    ],
  },
  {
    stage: 'STAGE 4',
    name: 'Agentic AI',
    color: '059669',
    def: 'Systems that perceive, reason, act, and self-correct in a loop. They plan multi-step workflows, use tools, and revise course. From assistance to end-to-end execution with human governance.',
    useCases: [
      'Auto-generated incident report',
      'LLM-judge escalation (FP filter)',
      'Visual memory: similar incidents',
      'Multi-camera mesh with re-ID',
      'Post-earthquake structural damage (YOLOv11)',
      'Coordinated disaster response',
      'INDECI/SINPAD escalation with report',
      'SASPe webhook → post-quake scan mode',
    ],
  },
]

export const CAPABILITIES_ES = [
  'Reglas deterministas · Entrada estructurada · Sin aprendizaje · Auditoría completa',
  'Percepción · Clasificación · Detección de anomalías · Reconocimiento de patrones',
  'Generación de contenido · Resumen · Traducción · Razonamiento superficial',
  'Planificación multi-paso · Uso de herramientas · Autocorrección · Orquestación',
]

export const CAPABILITIES_EN = [
  'Deterministic rules · Structured input · No learning · Full audit',
  'Perception · Classification · Anomaly detection · Pattern recognition',
  'Content generation · Summarization · Translation · Shallow reasoning',
  'Multi-step planning · Tool use · Self-correction · Orchestration',
]

export const LOOP_NODES_ES = [
  { name: 'Percibir', desc: 'COCO-SSD\nYOLOv8-seg\nYOLOv11-crack' },
  { name: 'Razonar', desc: 'Motor de reglas\n+ juez LLM' },
  { name: 'Actuar', desc: 'Snapshot\nEmail\nReporte INDECI' },
  { name: 'Reflexionar', desc: 'Veredicto LLM\n→ próximo ciclo' },
]

export const LOOP_NODES_EN = [
  { name: 'Perceive', desc: 'COCO-SSD\nYOLOv8-seg\nYOLOv11-crack' },
  { name: 'Reason', desc: 'Rule engine\n+ LLM judge' },
  { name: 'Act', desc: 'Snapshot\nEmail\nINDECI report' },
  { name: 'Reflect', desc: 'LLM verdict\n→ next tick' },
]

export const QUOTE_ES = 'La mayoría de los sistemas de cámaras cívicas son Etapa 2: cuentan personas y activan una alerta de umbral estático. Vision Agent cierra el ciclo — percibe la plaza, razona sobre anomalías, actúa vía escalada de 3 niveles, y reflexiona vía el juez LLM que filtra falsos positivos. El mismo pipeline Stage 1–5, ActionLog inmutable, disyuntor y cero backend sirve para detección comercial Y para desastres (inundación, deslizamiento, post-sismo).'

export const QUOTE_EN = 'Most civic-camera systems are Stage 2: they count people and trigger a static threshold alert. Vision Agent closes the loop — perceives the plaza, reasons about anomalies, acts via 3-tier escalation, and reflects via the LLM judge that filters false positives. The same Stage 1–5 pipeline, immutable ActionLog, circuit-breaker, and zero-backend architecture serves both commercial detection AND disaster modes (flood, landslide, post-quake).'
