/**
 * /api/export-pptx-v2 — McKinsey/BCG text-dense infographic style.
 *
 * Layout (13.333" × 7.5"):
 *   A: Header (logo, brand, meta)
 *   B: Title (action title)
 *   C: 4 era columns left-to-right with explanatory paragraphs + use cases
 *   D: Capabilities strip (4 cells aligned with columns, from Section 5/6)
 *   E: Agentic loop diagram (4 nodes + loop-back + Human Feedback, from "The Leap")
 *   F: Section 9 quote ("Most civic-camera systems are Stage 2...")
 *   G: Value generated + footer
 *
 * No dates, no money. All text from translation files.
 * Geometry validated by /home/z/my-project/scripts/validate-pptx-v2-geometry-v2.py
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pptxgen from 'pptxgenjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getMessages() {
  const store = await cookies()
  const locale = store.get('NEXT_LOCALE')?.value === 'es-PE' ? 'es-PE' : 'en'
  const messages = (await import(`../../../../messages/${locale}.json`)).default
  return { locale, messages }
}

const C = {
  emerald600: '059669', emerald50: 'ECFDF5', emerald100: 'D1FAE5',
  zinc950: '09090B', zinc800: '27272A', zinc700: '3F3F46', zinc600: '52525B',
  zinc500: '71717A', zinc400: 'A1A1AA', zinc300: 'D4D4D8', zinc200: 'E4E4E7',
  zinc100: 'F4F4F5', zinc50: 'FAFAFA',
  amber500: 'F59E0B', amber100: 'FEF3C7', amber50: 'FFFBEB',
  white: 'FFFFFF',
}

const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.30
const CONTENT_W = SLIDE_W - 2 * MARGIN

// Era columns
const COL_GAP = 0.15
const COL_W = (CONTENT_W - 3 * COL_GAP) / 4
const COL_Y = 1.10
const COL_H = 2.75

// Loop nodes
const LOOP_Y = 4.65
const LOOP_H = 0.60
const LOOP_NODE_W = 1.55
const LOOP_GAP = 0.50
const TOTAL_LOOP_W = 4 * LOOP_NODE_W + 3 * LOOP_GAP
const LOOP_START_X = (SLIDE_W - TOTAL_LOOP_W) / 2

export async function GET() {
  const { locale, messages } = await getMessages()
  const m = messages as Record<string, any>
  const t = (key: string): string => {
    const parts = key.split('.')
    let val: any = m
    for (const p of parts) val = val?.[p]
    return typeof val === 'string' ? val : key
  }
  const isES = locale === 'es-PE'

  const pres = new pptxgen()
  pres.defineLayout({ name: 'CUSTOM_WIDE', width: SLIDE_W, height: SLIDE_H })
  pres.layout = 'CUSTOM_WIDE'
  pres.title = 'Vision Agent — Strategic Brief V2'
  pres.author = 'Vision Agent'
  pres.company = 'Z.ai'

  const slide = pres.addSlide()
  slide.background = { color: C.white }

  // Compute column X positions
  const colXs = [0, 1, 2, 3].map((i) => MARGIN + i * (COL_W + COL_GAP))

  // ═══ ZONE A: HEADER ═══
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.30, y: 0.10, w: 0.45, h: 0.45,
    fill: { color: C.emerald600 }, line: { type: 'none' }, rectRadius: 0.08,
  })
  slide.addText('VA', {
    x: 0.30, y: 0.10, w: 0.45, h: 0.45,
    fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
  slide.addText(`${t('Header.brand')} — ${t('Nav.brief')}`, {
    x: 0.85, y: 0.10, w: 7.5, h: 0.45,
    fontSize: 13, bold: true, color: C.zinc950, align: 'left', valign: 'middle', fontFace: 'Georgia',
  })
  slide.addText(`${t('Header.version')}  ·  ${isES ? 'Perú' : 'Peru'}`, {
    x: 10.33, y: 0.10, w: 2.7, h: 0.45,
    fontSize: 9, color: C.zinc500, align: 'right', valign: 'middle', fontFace: 'Consolas',
  })
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN, y: 0.60, w: CONTENT_W, h: 0, line: { color: C.zinc200, width: 1 },
  })

  // ═══ ZONE B: TITLE ═══
  slide.addText(
    isES
      ? 'La IA evolucionó en cuatro etapas — cada una añadió capacidades que la anterior no tenía, hasta llegar a sistemas que actúan autónomamente.'
      : 'AI evolved through four stages — each adding capabilities the previous lacked, culminating in systems that act autonomously.',
    {
      x: MARGIN, y: 0.65, w: CONTENT_W, h: 0.40,
      fontSize: 14, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    }
  )

  // ═══ ZONE C: 4 ERA COLUMNS ═══
  const eraData = [
    {
      stage: isES ? 'ETAPA 1' : 'STAGE 1',
      name: isES ? 'Programas Estáticos' : 'Static Programs',
      color: C.zinc400,
      def: isES
        ? 'Los humanos codifican reglas; el sistema ejecuta lógica determinista. Cada decisión es auditable porque un humano escribió cada regla. Sin aprendizaje ni adaptación.'
        : 'Humans encode rules; the system executes deterministic logic. Every decision is auditable because a human wrote each rule. No learning or adaptation.',
      useCases: isES
        ? ['Conteo de personas y vehículos', 'Detección de intrusión en zonas', 'Monitoreo de colas', 'Disponibilidad de estacionamiento', 'Dwell time en bahías de carga']
        : ['People & vehicle counting', 'Zone intrusion detection', 'Queue monitoring', 'Parking availability', 'Loading bay dwell time'],
    },
    {
      stage: isES ? 'ETAPA 2' : 'STAGE 2',
      name: isES ? 'ML / Deep Learning' : 'ML / Deep Learning',
      color: C.zinc600,
      def: isES
        ? 'Los modelos aprenden patrones de los datos. Ningún humano escribe las reglas — el modelo las descubre. Percepción a escala: clasificación, detección de anomalías, reconocimiento.'
        : 'Models learn patterns from data. No human writes the rules — the model discovers them. Perception at scale: classification, anomaly detection, recognition.',
      useCases: isES
        ? ['Grafiti y vandalismo en fachadas', 'Objetos abandonados o sospechosos', 'Fuego y humo (3 fotogramas)', 'Resbalones y superficies mojadas', 'Intrusión vehicular fuera de horario', 'Cámaras térmicas nocturnas', 'Nivel de agua e inundaciones', 'Deslizamientos con frame-diff']
        : ['Graffiti & façade vandalism', 'Abandoned/suspicious objects', 'Fire & smoke (3-frame verify)', 'Slip & wet surface hazards', 'After-hours vehicle intrusion', 'Night thermal cameras', 'Water level & flood detection', 'Landslide frame-diff detection'],
    },
    {
      stage: isES ? 'ETAPA 3' : 'STAGE 3',
      name: isES ? 'IA Cognitiva / Generativa' : 'Cognitive / Generative AI',
      color: C.amber500,
      def: isES
        ? 'Modelos que sintetizan nuevo contenido — texto, código, imágenes. Asistentes que resumen, traducen y responden preguntas, pero no pueden actuar en el mundo ni perseguir objetivos.'
        : 'Models that synthesize new content — text, code, images. Assistants that summarize, translate, and answer questions, but cannot act in the world or pursue goals.',
      useCases: isES
        ? ['Descripción automática de incidentes', 'Resumen de eventos del día', 'Traducción multilingüe de reportes', 'Clasificación de severidad por lenguaje', 'Consultas en lenguaje natural sobre video']
        : ['Auto incident description', 'Daily event summarization', 'Multilingual report translation', 'Severity classification by language', 'Natural language video queries'],
    },
    {
      stage: isES ? 'ETAPA 4' : 'STAGE 4',
      name: isES ? 'IA Autónoma' : 'Agentic AI',
      color: C.emerald600,
      def: isES
        ? 'Sistemas que perciben, razonan, actúan y se autocorrigen en un ciclo. Planifican flujos multi-paso, usan herramientas y revisan el curso. De la asistencia a la ejecución de extremo a extremo.'
        : 'Systems that perceive, reason, act, and self-correct in a loop. They plan multi-step workflows, use tools, and revise course. From assistance to end-to-end execution.',
      useCases: isES
        ? ['Reporte de incidente auto-generado', 'Escalada con juez LLM (filtra FP)', 'Memoria visual: incidentes similares', 'Malla multicámara con re-ID', 'Daño estructural post-sismo', 'Inteligencia de negocio (conversión)', 'Respuesta coordinada a desastres', 'Escalada a servicios de emergencia']
        : ['Auto-generated incident report', 'LLM-judge escalation (FP filter)', 'Visual memory: similar incidents', 'Multi-camera mesh with re-ID', 'Post-earthquake structural damage', 'Business intelligence (conversion)', 'Coordinated disaster response', 'Emergency services escalation'],
    },
  ]

  eraData.forEach((era, i) => {
    const cx = colXs[i]

    // Card background
    slide.addShape(pres.ShapeType.roundRect, {
      x: cx, y: COL_Y, w: COL_W, h: COL_H,
      fill: { color: C.white }, line: { color: C.zinc200, width: 1 },
      rectRadius: 0.04,
      shadow: { type: 'outer', blur: 3, offset: 1, color: '000000', opacity: 0.06 },
    })

    // Color header bar
    slide.addShape(pres.ShapeType.rect, {
      x: cx, y: COL_Y, w: COL_W, h: 0.06,
      fill: { color: era.color }, line: { type: 'none' },
    })

    // Stage label
    slide.addText(era.stage, {
      x: cx + 0.10, y: COL_Y + 0.10, w: COL_W - 0.20, h: 0.20,
      fontSize: 7, bold: true, color: C.zinc400, align: 'left', valign: 'middle',
      fontFace: 'Consolas',
    })

    // Era name
    slide.addText(era.name, {
      x: cx + 0.10, y: COL_Y + 0.28, w: COL_W - 0.20, h: 0.25,
      fontSize: 12, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    })

    // Definition paragraph
    slide.addText(era.def, {
      x: cx + 0.10, y: COL_Y + 0.55, w: COL_W - 0.20, h: 0.68,
      fontSize: 8, color: C.zinc600, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.15, shrinkText: true,
    })

    // Use cases label
    slide.addText(isES ? 'CASOS DE USO' : 'USE CASES', {
      x: cx + 0.10, y: COL_Y + 1.25, w: COL_W - 0.20, h: 0.15,
      fontSize: 7, bold: true, color: era.color, align: 'left', valign: 'middle',
      fontFace: 'Consolas',
    })

    // Use cases bullets
    const ucText = era.useCases.map((uc) => `• ${uc}`).join('\n')
    slide.addText(ucText, {
      x: cx + 0.10, y: COL_Y + 1.42, w: COL_W - 0.20, h: 1.25,
      fontSize: 7.5, color: C.zinc700, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.2, shrinkText: true,
    })
  })

  // ═══ ZONE D: CAPABILITIES STRIP ═══
  const capData = [
    isES ? 'Reglas deterministas · Entrada estructurada · Sin aprendizaje · Auditoría completa'
      : 'Deterministic rules · Structured input · No learning · Full audit',
    isES ? 'Percepción · Clasificación · Detección de anomalías · Reconocimiento de patrones'
      : 'Perception · Classification · Anomaly detection · Pattern recognition',
    isES ? 'Generación de contenido · Resumen · Traducción · Razonamiento superficial'
      : 'Content generation · Summarization · Translation · Shallow reasoning',
    isES ? 'Planificación multi-paso · Uso de herramientas · Autocorrección · Orquestación'
      : 'Multi-step planning · Tool use · Self-correction · Orchestration',
  ]

  capData.forEach((cap, i) => {
    const cx = colXs[i]
    slide.addShape(pres.ShapeType.rect, {
      x: cx, y: 3.90, w: COL_W, h: 0.45,
      fill: { color: C.zinc50 }, line: { color: C.zinc200, width: 1 },
    })
    slide.addText(cap, {
      x: cx + 0.08, y: 3.93, w: COL_W - 0.16, h: 0.39,
      fontSize: 7, color: C.zinc600, align: 'left', valign: 'middle', fontFace: 'Calibri',
      shrinkText: true,
    })
  })

  // ═══ ZONE E: AGENTIC LOOP DIAGRAM ═══
  // Section label
  slide.addText(isES ? 'CICLO AUTÓNOMO — CON RETROALIMENTACIÓN HUMANA' : 'AGENTIC LOOP — WITH HUMAN FEEDBACK', {
    x: MARGIN, y: 4.40, w: 6, h: 0.20,
    fontSize: 8, bold: true, color: C.emerald600, align: 'left', valign: 'middle',
    fontFace: 'Consolas',
  })

  // 4 loop nodes
  const loopNames = isES ? ['Percibir', 'Razonar', 'Actuar', 'Reflexionar'] : ['Perceive', 'Reason', 'Act', 'Reflect']
  const loopDescs = isES
    ? ['COCO-SSD\n90 clases', 'Motor de reglas\n+ juez LLM', 'Snapshot\nEmail\nReporte', 'Veredicto LLM\n→ próximo ciclo']
    : ['COCO-SSD\n90 classes', 'Rule engine\n+ LLM judge', 'Snapshot\nEmail\nReport', 'LLM verdict\n→ next tick']

  const loopCenters: number[] = []
  loopNames.forEach((name, i) => {
    const nx = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP)
    loopCenters.push(nx + LOOP_NODE_W / 2)

    slide.addShape(pres.ShapeType.roundRect, {
      x: nx, y: LOOP_Y, w: LOOP_NODE_W, h: LOOP_H,
      fill: { color: i === 3 ? C.emerald50 : C.white },
      line: { color: C.emerald600, width: 1.5 }, rectRadius: 0.06,
      shadow: { type: 'outer', blur: 3, offset: 1, color: '059669', opacity: 0.12 },
    })

    // Step number badge
    slide.addShape(pres.ShapeType.ellipse, {
      x: nx + LOOP_NODE_W - 0.28, y: LOOP_Y - 0.05, w: 0.22, h: 0.22,
      fill: { color: C.emerald600 }, line: { color: C.white, width: 1 },
    })
    slide.addText(String(i + 1), {
      x: nx + LOOP_NODE_W - 0.28, y: LOOP_Y - 0.05, w: 0.22, h: 0.22,
      fontSize: 8, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Consolas',
    })

    slide.addText(name, {
      x: nx, y: LOOP_Y + 0.05, w: LOOP_NODE_W, h: 0.20,
      fontSize: 11, bold: true, color: C.emerald600, align: 'center', valign: 'middle', fontFace: 'Georgia',
    })
    slide.addText(loopDescs[i], {
      x: nx + 0.05, y: LOOP_Y + 0.25, w: LOOP_NODE_W - 0.10, h: 0.30,
      fontSize: 7, color: C.zinc600, align: 'center', valign: 'top', fontFace: 'Calibri',
      shrinkText: true,
    })
  })

  // Forward arrows
  for (let i = 0; i < 3; i++) {
    const srcX = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP) + LOOP_NODE_W
    const dstX = LOOP_START_X + (i + 1) * (LOOP_NODE_W + LOOP_GAP)
    slide.addShape(pres.ShapeType.rightArrow, {
      x: srcX, y: LOOP_Y + LOOP_H / 2 - 0.06, w: dstX - srcX, h: 0.12,
      fill: { color: C.emerald600 }, line: { type: 'none' },
    })
  }

  // Loop-back path
  const reflectCx = loopCenters[3]
  const perceiveCx = loopCenters[0]
  const loopBackY = LOOP_Y + LOOP_H + 0.20

  slide.addShape(pres.ShapeType.downArrow, {
    x: reflectCx - 0.05, y: LOOP_Y + LOOP_H, w: 0.10, h: 0.25,
    fill: { color: C.emerald600 }, line: { type: 'none' },
  })
  slide.addShape(pres.ShapeType.leftArrow, {
    x: perceiveCx, y: loopBackY, w: reflectCx - perceiveCx, h: 0.10,
    fill: { color: C.emerald600 }, line: { type: 'none' },
  })
  slide.addShape(pres.ShapeType.upArrow, {
    x: perceiveCx - 0.05, y: loopBackY, w: 0.10, h: 0.25,
    fill: { color: C.emerald600 }, line: { type: 'none' },
  })
  slide.addText(isES ? '↻ ciclo autónomo' : '↻ autonomous loop', {
    x: (perceiveCx + reflectCx) / 2 - 1.0, y: loopBackY + 0.12, w: 2.0, h: 0.18,
    fontSize: 7, bold: true, color: C.emerald600, align: 'center', valign: 'middle', fontFace: 'Consolas',
  })

  // Human Feedback node
  const HF_W = 3.00
  const HF_H = 0.50
  const HF_X = (SLIDE_W - HF_W) / 2
  const HF_Y = loopBackY + 0.35

  slide.addShape(pres.ShapeType.roundRect, {
    x: HF_X, y: HF_Y, w: HF_W, h: HF_H,
    fill: { color: C.amber50 }, line: { color: C.amber500, width: 1.5 }, rectRadius: 0.06,
  })
  // Human icon circle
  slide.addShape(pres.ShapeType.ellipse, {
    x: HF_X + 0.08, y: HF_Y + 0.10, w: 0.30, h: 0.30,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })
  slide.addText('H', {
    x: HF_X + 0.08, y: HF_Y + 0.10, w: 0.30, h: 0.30,
    fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
  slide.addText(
    [
      { text: isES ? 'Retroalimentación Humana' : 'Human Feedback', options: { fontSize: 10, bold: true, color: C.zinc950, fontFace: 'Georgia', breakLine: true } },
      { text: isES ? 'Reconocer · Silenciar · Ajustar umbrales' : 'Acknowledge · Silence · Tune thresholds', options: { fontSize: 7, color: C.zinc600, fontFace: 'Calibri' } },
    ],
    { x: HF_X + 0.45, y: HF_Y + 0.03, w: HF_W - 0.55, h: HF_H - 0.06, align: 'left', valign: 'middle', shrinkText: true }
  )

  // Bidirectional arrows to Human Feedback
  const midX = (perceiveCx + reflectCx) / 2
  slide.addShape(pres.ShapeType.downArrow, {
    x: midX - 0.10, y: loopBackY + 0.12, w: 0.07, h: HF_Y - loopBackY - 0.12,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })
  slide.addShape(pres.ShapeType.upArrow, {
    x: midX + 0.03, y: loopBackY + 0.12, w: 0.07, h: HF_Y - loopBackY - 0.12,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })

  // ═══ ZONE F: SECTION 9 QUOTE ═══
  slide.addShape(pres.ShapeType.rect, {
    x: MARGIN, y: 6.30, w: CONTENT_W, h: 0.50,
    fill: { color: C.emerald50 }, line: { color: C.emerald600, width: 1 },
  })
  slide.addText(
    isES
      ? 'La mayoría de los sistemas de cámaras cívicas son Etapa 2: cuentan personas y activan una alerta de umbral estático. Vision Agent cierra el ciclo — percibe la plaza, razona sobre anomalías, actúa vía escalada de 3 niveles, y reflexiona vía el juez LLM que filtra falsos positivos.'
      : 'Most civic-camera systems are Stage 2: they count people and trigger a static threshold alert. Vision Agent closes the loop — perceives the plaza, reasons about anomalies, acts via 3-tier escalation, and reflects via the LLM judge that filters false positives.',
    {
      x: MARGIN + 0.15, y: 6.33, w: CONTENT_W - 0.30, h: 0.44,
      fontSize: 8, italic: true, color: C.zinc800, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    }
  )

  // ═══ ZONE G: VALUE + FOOTER ═══
  slide.addText(
    isES
      ? 'VALOR GENERADO: respuesta automática · evidencia auditable · gobernanza con disyuntor · reportes auto-generados · juez LLM'
      : 'VALUE GENERATED: auto-response · auditable evidence · circuit-breaker governance · auto-generated reports · LLM judge',
    {
      x: MARGIN, y: 6.85, w: CONTENT_W, h: 0.20,
      fontSize: 7, bold: true, color: C.emerald600, align: 'right', valign: 'middle',
      fontFace: 'Consolas', shrinkText: true,
    }
  )
  slide.addText(
    isES
      ? 'Fuentes: McKinsey · BCG · Bain · Gartner · Deloitte · WEF · Stanford HAI · MIT Sloan · Sequoia · VastData'
      : 'Sources: McKinsey · BCG · Bain · Gartner · Deloitte · WEF · Stanford HAI · MIT Sloan · Sequoia · VastData',
    {
      x: MARGIN, y: 7.10, w: CONTENT_W, h: 0.25,
      fontSize: 7, color: C.zinc400, align: 'left', valign: 'middle', fontFace: 'Consolas',
    }
  )

  // Generate
  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Uint8Array
  return new NextResponse(buffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': 'attachment; filename="vision-agent-infographic.pptx"',
      'Content-Length': buffer.length.toString(),
    },
  })
}
