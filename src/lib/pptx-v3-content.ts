/**
 * V3 PPTX content — BCP-targeted, Z-flow infographic.
 *
 * Target audience: VP del área de seguridad de sedes BCP con cámaras.
 * Tone: corporativo, denso pero legible, estilo BCG/McKinsey.
 * Language: español peruano (es-PE).
 * No dates, no monetary figures.
 *
 * Each era card has:
 *   - name + paragraph (what it is)
 *   - capabilities (what it can do)
 *   - differential value (what it adds vs previous era)
 *   - BCP use cases (concrete applications for bank branch security)
 */

export interface EraCardV3 {
  stage: string
  name: string
  color: string // hex
  paragraph: string
  capabilities: string
  differentialValue: string
  bcpUseCases: string[]
}

export const ERAS_V3: EraCardV3[] = [
  {
    stage: '1',
    name: 'Tradicional',
    color: 'A1A1AA',
    paragraph:
      'Reglas deterministas escritas por humanos. El sistema ejecuta lógica fija: si X entonces Y. Auditable pero rígido — cada caso nuevo requiere una regla nueva.',
    capabilities:
      '• Conteo de personas y vehículos\n• Detección de intrusión en zonas\n• Alertas de umbral fijo\n• Grabación y reproducción\n• Monitoreo manual en vivo',
    differentialValue:
      'Línea base de automatización. Sin aprendizaje. El operador debe interpretar cada alerta.',
    bcpUseCases: [
      'Conteo de visitantes en agencia',
      'Detección de intrusión después de horas',
      'Alerta de puerta abierta en bóveda',
      'Verificación manual de incidentes',
    ],
  },
  {
    stage: '2',
    name: 'ML / Deep Learning',
    color: '52525B',
    paragraph:
      'Modelos que aprenden patrones de los datos. El sistema percibe: clasifica imágenes, detecta anomalías, reconoce objetos — sin que un humano escriba las reglas.',
    capabilities:
      '• Detección de objetos (COCO-SSD)\n• Reconocimiento de actividades\n• Detección de anomalías visuales\n• Clasificación de escenas\n• Puntaje de riesgo automático',
    differentialValue:
      'Añade PERCEPCIÓN. El sistema ve y entiende lo que pasa en el frame, no solo cuenta píxeles.',
    bcpUseCases: [
      'Grafiti y vandalismo en fachadas',
      'Objetos abandonados en agencia',
      'Fuego y humo (verificación 3 frames)',
      'Colas largas en cajeros',
      'Resbalones y superficies mojadas',
      'Intrusión vehicular fuera de horario',
    ],
  },
  {
    stage: '3',
    name: 'Cognitiva / GenAI',
    color: 'F59E0B',
    paragraph:
      'Modelos que sintetizan contenido — texto, descripciones, resúmenes. El sistema describe lo que ve en lenguaje natural, pero no puede actuar por sí solo.',
    capabilities:
      '• Descripción automática de incidentes\n• Resumen de eventos del día\n• Traducción multilingüe\n• Clasificación de severidad\n• Consultas en lenguaje natural',
    differentialValue:
      'Añade ENTENDIMIENTO. El sistema no solo detecta — explica qué pasa y qué tan grave es.',
    bcpUseCases: [
      'Descripción automática de incidentes',
      'Resumen de eventos para reportes',
      'Clasificación de severidad de alertas',
      'Consultas: "¿hubo aglomeraciones hoy?"',
      'Traducción de reportes a inglés',
    ],
  },
  {
    stage: '4',
    name: 'IA Autónoma',
    color: '059669',
    paragraph:
      'Sistemas que perciben, razonan, actúan y se autocorrigen en un ciclo. Planifican, usan herramientas, generan reportes y escalan — con gobernanza humana.',
    capabilities:
      '• Ciclo percibir → razonar → actuar → reflexionar\n• Uso de herramientas (email, reporte, snapshot)\n• Juez LLM filtra falsos positivos\n• Disyuntor (max 5 escaladas/hora)\n• Reporte de incidente auto-generado\n• Retroalimentación humana integrada',
    differentialValue:
      'Añade ACCIÓN AUTÓNOMA. El sistema no solo detecta y describe — decide, ejecuta y aprende. Cierra el ciclo.',
    bcpUseCases: [
      'Reporte de incidente auto-generado',
      'Escalada con juez LLM (filtra FP)',
      'Snapshot + email automático a operaciones',
      'Memoria visual: incidentes similares',
      'Malla multicámara con re-ID',
      'Coordinación con centro de monitoreo',
      'Reportes compatibles INDECI/SINPAD',
    ],
  },
]

export const TITLE_ES =
  'De cámaras que graban a cámaras que razonan y actúan — la evolución de la inteligencia de video para seguridad de sedes BCP'

export const VALUE_STRIP_ES =
  'De REACTIVA (grabar y revisar) → a PERCEPTIVA (detectar anomalías) → a COGNITIVA (entender y describir) → a AUTÓNOMA (decidir, actuar y aprender con gobernanza humana)'

export const BCP_TARGET_ES =
  'Dirigido a: VP de Seguridad de Sedes BCP  ·  Objetivo: reducir MTTR, eliminar falsos positivos, automatizar reportes'

export const SOURCES_ES =
  'Fuentes: McKinsey · BCG · Bain · Gartner · Deloitte · WEF · Stanford HAI · MIT Sloan · Sequoia  ·  Arquitectura: TF.js COCO-SSD + motor de reglas + LLM juez + disyuntor'

export const COPYRIGHT_ES =
  'Vision Agent v1.0  ·  Inteligencia de cámaras autónoma para sedes BCP  ·  Cero backend, inferencia local, evidencia auditable'
