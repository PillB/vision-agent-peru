/**
 * /api/export-pptx-v2 — Infographic/timeline style PowerPoint.
 *
 * DIFFERENCES vs v1 (4-card layout):
 *   - Horizontal timeline arrow with 4 era nodes + year markers + value callouts
 *   - Agentic loop as a horizontal flow: Percibir → Razonar → Actuar → Reflexionar ↻
 *   - Human Feedback node (our customization) connected with bidirectional arrows
 *   - 3-tier use cases row: Traditional | ML/DL Modern | Agentic Future
 *   - More visual, infographic-leaning style
 *
 * Geometry validated by /home/z/my-project/scripts/validate-pptx-v2-geometry.py
 * All measurements in inches. Slide: 13.333" × 7.5" (16:9 widescreen).
 *
 * All objects are NATIVE PowerPoint shapes (fully editable).
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pptxgen from 'pptxgenjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── i18n ───────────────────────────────────────────────────────────────────
async function getMessages() {
  const store = await cookies()
  const locale = store.get('NEXT_LOCALE')?.value === 'es-PE' ? 'es-PE' : 'en'
  const messages = (await import(`../../../../messages/${locale}.json`)).default
  return { locale, messages }
}

// ─── Colors ─────────────────────────────────────────────────────────────────
const C = {
  emerald600: '059669',
  emerald500: '10B981',
  emerald50: 'ECFDF5',
  emerald100: 'D1FAE5',
  zinc950: '09090B',
  zinc800: '27272A',
  zinc700: '3F3F46',
  zinc600: '52525B',
  zinc500: '71717A',
  zinc400: 'A1A1AA',
  zinc300: 'D4D4D8',
  zinc200: 'E4E4E7',
  zinc100: 'F4F4F5',
  zinc50: 'FAFAFA',
  amber500: 'F59E0B',
  amber100: 'FEF3C7',
  amber50: 'FFFBEB',
  rose600: 'E11D48',
  rose100: 'FEE2E2',
  white: 'FFFFFF',
  blue400: '60A5FA', // only for "human feedback" accent — NOT a brand color
}

// ─── Layout constants (validated by Python script) ──────────────────────────
const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.30
const CONTENT_W = SLIDE_W - 2 * MARGIN

// Era node positions (validated)
const NODE_W = 2.50
const NODE_H = 1.00
const NODE_Y = 1.35
const NODE_CENTERS = [1.5, 4.6, 7.7, 10.8]

// Loop node positions (validated)
const LOOP_Y = 4.15
const LOOP_H = 0.95
const LOOP_NODE_W = 1.85
const LOOP_GAP = 0.55
const TOTAL_LOOP_W = 4 * LOOP_NODE_W + 3 * LOOP_GAP // 9.05"
const LOOP_START_X = (SLIDE_W - TOTAL_LOOP_W) / 2 // 2.14"

// Use case tier positions (validated)
const UC_Y = 6.40
const UC_H = 0.90
const UC_W = (CONTENT_W - 2 * 0.20) / 3 // 4.11"
const UC_GAP = 0.20

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
  pres.title = 'Vision Agent — Strategic Brief V2 (Infographic)'
  pres.author = 'Vision Agent'
  pres.company = 'Z.ai'

  const slide = pres.addSlide()
  slide.background = { color: C.white }

  // ════════════════════════════════════════════════════════════════════════
  // ZONE A: HEADER (y: 0.10 – 0.62)
  // ════════════════════════════════════════════════════════════════════════

  // Logo: emerald rounded rectangle with "VA" text
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.30, y: 0.10, w: 0.45, h: 0.45,
    fill: { color: C.emerald600 }, line: { type: 'none' }, rectRadius: 0.08,
  })
  slide.addText('VA', {
    x: 0.30, y: 0.10, w: 0.45, h: 0.45,
    fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Georgia',
  })

  // Brand title
  slide.addText(`${t('Header.brand')} — ${t('Nav.brief')}`, {
    x: 0.85, y: 0.10, w: 7.5, h: 0.45,
    fontSize: 13, bold: true, color: C.zinc950, align: 'left', valign: 'middle', fontFace: 'Georgia',
  })

  // Meta tag
  slide.addText(`${t('Header.version')}  ·  ${isES ? '14/07/2026' : '2026-07-14'}  ·  ${isES ? 'Perú' : 'Peru'}`, {
    x: 10.33, y: 0.10, w: 2.7, h: 0.45,
    fontSize: 9, color: C.zinc500, align: 'right', valign: 'middle', fontFace: 'Consolas',
  })

  // Header separator line
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN, y: 0.62, w: CONTENT_W, h: 0,
    line: { color: C.zinc200, width: 1 },
  })

  // ════════════════════════════════════════════════════════════════════════
  // ZONE B: TITLE (y: 0.70 – 1.15)
  // ════════════════════════════════════════════════════════════════════════
  slide.addText(t('Tab3.slide1.title'), {
    x: MARGIN, y: 0.70, w: CONTENT_W, h: 0.45,
    fontSize: 15, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
    fontFace: 'Georgia', shrinkText: true,
  })

  // ════════════════════════════════════════════════════════════════════════
  // ZONE C: TIMELINE (y: 1.25 – 3.80)
  // ════════════════════════════════════════════════════════════════════════

  // Timeline section label
  slide.addText(isES ? 'EVOLUCIÓN DE LA IA — 70 AÑOS' : 'AI EVOLUTION — 70 YEARS', {
    x: MARGIN, y: 1.20, w: 4, h: 0.20,
    fontSize: 8, bold: true, color: C.emerald600, align: 'left', valign: 'middle',
    fontFace: 'Consolas',
  })

  // 4 era nodes (above the arrow)
  const eraColors = [C.zinc400, C.zinc600, C.amber500, C.emerald600]
  const eraKeys = ['stage1', 'stage2', 'stage3', 'stage4']
  const eraYears = ['1956', '1986', '2017', '2024']

  eraKeys.forEach((kp, i) => {
    const cx = NODE_CENTERS[i]
    const nx = cx - NODE_W / 2
    const color = eraColors[i]

    // Node card
    slide.addShape(pres.ShapeType.roundRect, {
      x: nx, y: NODE_Y, w: NODE_W, h: NODE_H,
      fill: { color: C.white }, line: { color: C.zinc200, width: 1 },
      rectRadius: 0.06,
      shadow: { type: 'outer', blur: 3, offset: 1, color: '000000', opacity: 0.08 },
    })

    // Color bar at top of node
    slide.addShape(pres.ShapeType.rect, {
      x: nx, y: NODE_Y, w: NODE_W, h: 0.06,
      fill: { color }, line: { type: 'none' },
    })

    // Stage number + era year
    slide.addText(
      [
        { text: `${isES ? 'ETAPA' : 'STAGE'} ${i + 1}`, options: { fontSize: 7, color: C.zinc400, fontFace: 'Consolas', breakLine: true } },
        { text: eraYears[i], options: { fontSize: 10, bold: true, color, fontFace: 'Consolas' } },
      ],
      { x: nx + 0.10, y: NODE_Y + 0.10, w: NODE_W - 0.20, h: 0.35, align: 'left', valign: 'top' }
    )

    // Stage name
    slide.addText(t(`Stages.${kp}Name`), {
      x: nx + 0.10, y: NODE_Y + 0.40, w: NODE_W - 0.20, h: 0.25,
      fontSize: 11, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    })

    // Short description (trimmed for fit)
    const shortDescs: Record<string, { en: string; es: string }> = {
      stage1: { en: 'Rules, deterministic', es: 'Reglas, determinista' },
      stage2: { en: 'Patterns from data', es: 'Patrones de datos' },
      stage3: { en: 'Content synthesis', es: 'Síntesis de contenido' },
      stage4: { en: 'Perceive-reason-act loop', es: 'Ciclo percibir-razonar-actuar' },
    }
    slide.addText(isES ? shortDescs[kp].es : shortDescs[kp].en, {
      x: nx + 0.10, y: NODE_Y + 0.65, w: NODE_W - 0.20, h: 0.30,
      fontSize: 8, color: C.zinc600, align: 'left', valign: 'top', fontFace: 'Calibri',
      shrinkText: true,
    })
  })

  // Timeline arrow (full width, below nodes)
  slide.addShape(pres.ShapeType.pentagon, {
    x: 0.50, y: 2.50, w: 12.33, h: 0.35,
    fill: { color: C.zinc100 }, line: { color: C.zinc300, width: 1 },
  })

  // Connector lines from each era node down to the timeline arrow
  eraKeys.forEach((_, i) => {
    const cx = NODE_CENTERS[i]
    // Vertical connector line from node bottom to arrow top
    slide.addShape(pres.ShapeType.line, {
      x: cx, y: NODE_Y + NODE_H, w: 0, h: 2.50 - (NODE_Y + NODE_H),
      line: { color: eraColors[i], width: 1.5, dashType: 'dash' },
    })
    // Small dot at the connection point on the arrow
    slide.addShape(pres.ShapeType.ellipse, {
      x: cx - 0.05, y: 2.50 - 0.05, w: 0.10, h: 0.10,
      fill: { color: eraColors[i] }, line: { type: 'none' },
    })
  })

  // Year labels below arrow
  eraYears.forEach((yr, i) => {
    const cx = NODE_CENTERS[i]
    slide.addText(yr, {
      x: cx - 0.5, y: 2.95, w: 1.0, h: 0.25,
      fontSize: 11, bold: true, color: C.zinc700, align: 'center', valign: 'middle',
      fontFace: 'Consolas',
    })
  })

  // Value callouts below years
  const valueTexts = [
    { en: 'Scalable bounded automation', es: 'Automatización delimitada' },
    { en: 'Perception at scale', es: 'Percepción a escala' },
    { en: '$33.9B invested · 78% use AI', es: '$33.9 mil M · 78% usa IA' },
    { en: 'End-to-end process execution', es: 'Ejecución de extremo a extremo' },
  ]

  valueTexts.forEach((vt, i) => {
    const cx = NODE_CENTERS[i]
    const vx = cx - 1.0
    const color = eraColors[i]

    // Value box
    slide.addShape(pres.ShapeType.rect, {
      x: vx, y: 3.30, w: 2.0, h: 0.50,
      fill: { color: C.zinc50 }, line: { color: C.zinc200, width: 1 },
    })

    // Value text
    slide.addText(
      [
        { text: `${isES ? 'VALOR' : 'VALUE'}\n`, options: { fontSize: 6, bold: true, color, fontFace: 'Consolas' } },
        { text: isES ? vt.es : vt.en, options: { fontSize: 8, color: C.zinc800, fontFace: 'Calibri' } },
      ],
      {
        x: vx + 0.08, y: 3.32, w: 1.84, h: 0.46,
        align: 'center', valign: 'middle', shrinkText: true,
      }
    )
  })

  // ════════════════════════════════════════════════════════════════════════
  // ZONE D: AGENTIC LOOP (y: 3.95 – 6.20)
  // ════════════════════════════════════════════════════════════════════════

  // Section label
  slide.addText(isES ? 'CICLO AUTÓNOMO — CON RETROALIMENTACIÓN HUMANA' : 'AGENTIC LOOP — WITH HUMAN FEEDBACK', {
    x: MARGIN, y: 3.90, w: 6, h: 0.20,
    fontSize: 8, bold: true, color: C.emerald600, align: 'left', valign: 'middle',
    fontFace: 'Consolas',
  })

  // 4 loop nodes
  const loopNames = isES
    ? ['Percibir', 'Razonar', 'Actuar', 'Reflexionar']
    : ['Perceive', 'Reason', 'Act', 'Reflect']
  const loopDescs = isES
    ? ['COCO-SSD\n90 clases', 'Motor de reglas\n+ juez LLM', 'Snapshot\nEmail\nReporte', 'Veredicto LLM\n→ siguiente ciclo']
    : ['COCO-SSD\n90 classes', 'Rule engine\n+ LLM judge', 'Snapshot\nEmail\nReport', 'LLM verdict\n→ next tick']
  const loopIcons = ['👁', '🧠', '⚡', '🔄']

  loopNames.forEach((name, i) => {
    const nx = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP)

    // Node card — emerald for the loop, with subtle gradient effect via two shapes
    slide.addShape(pres.ShapeType.roundRect, {
      x: nx, y: LOOP_Y, w: LOOP_NODE_W, h: LOOP_H,
      fill: { color: i === 3 ? C.emerald50 : C.white },
      line: { color: C.emerald600, width: 1.5 },
      rectRadius: 0.06,
      shadow: { type: 'outer', blur: 4, offset: 1, color: '059669', opacity: 0.15 },
    })

    // Step number badge (circle in top-right of node)
    slide.addShape(pres.ShapeType.ellipse, {
      x: nx + LOOP_NODE_W - 0.30, y: LOOP_Y - 0.05, w: 0.25, h: 0.25,
      fill: { color: C.emerald600 }, line: { color: C.white, width: 1 },
    })
    slide.addText(String(i + 1), {
      x: nx + LOOP_NODE_W - 0.30, y: LOOP_Y - 0.05, w: 0.25, h: 0.25,
      fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle',
      fontFace: 'Consolas',
    })

    // Node label
    slide.addText(name, {
      x: nx, y: LOOP_Y + 0.08, w: LOOP_NODE_W, h: 0.30,
      fontSize: 12, bold: true, color: C.emerald600, align: 'center', valign: 'middle',
      fontFace: 'Georgia',
    })

    // Node description
    slide.addText(loopDescs[i], {
      x: nx + 0.05, y: LOOP_Y + 0.38, w: LOOP_NODE_W - 0.10, h: 0.50,
      fontSize: 8, color: C.zinc600, align: 'center', valign: 'top', fontFace: 'Calibri',
      shrinkText: true,
    })
  })

  // Forward arrows between loop nodes (3 arrows)
  for (let i = 0; i < 3; i++) {
    const srcX = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP) + LOOP_NODE_W // right edge of src
    const dstX = LOOP_START_X + (i + 1) * (LOOP_NODE_W + LOOP_GAP) // left edge of dst
    const arrowY = LOOP_Y + LOOP_H / 2 - 0.06
    const arrowW = dstX - srcX

    slide.addShape(pres.ShapeType.rightArrow, {
      x: srcX, y: arrowY, w: arrowW, h: 0.12,
      fill: { color: C.emerald600 }, line: { type: 'none' },
    })
  }

  // Loop-back path: down from Reflect → left → up to Perceive
  const reflectCx = LOOP_START_X + 3 * (LOOP_NODE_W + LOOP_GAP) + LOOP_NODE_W / 2
  const perceiveCx = LOOP_START_X + LOOP_NODE_W / 2
  const loopBackY = LOOP_Y + LOOP_H + 0.25

  // Down arrow from Reflect bottom
  slide.addShape(pres.ShapeType.downArrow, {
    x: reflectCx - 0.06, y: LOOP_Y + LOOP_H, w: 0.12, h: 0.30,
    fill: { color: C.emerald600 }, line: { type: 'none' },
  })

  // Left arrow along the bottom (from reflect to perceive)
  slide.addShape(pres.ShapeType.leftArrow, {
    x: perceiveCx, y: loopBackY, w: reflectCx - perceiveCx, h: 0.12,
    fill: { color: C.emerald600 }, line: { type: 'none' },
  })

  // Up arrow to Perceive bottom
  slide.addShape(pres.ShapeType.upArrow, {
    x: perceiveCx - 0.06, y: loopBackY, w: 0.12, h: 0.30,
    fill: { color: C.emerald600 }, line: { type: 'none' },
  })

  // "Loop" label on the loop-back arrow
  slide.addText(isES ? '↻ ciclo autónomo' : '↻ autonomous loop', {
    x: (perceiveCx + reflectCx) / 2 - 1.0, y: loopBackY + 0.15, w: 2.0, h: 0.20,
    fontSize: 8, bold: true, color: C.emerald600, align: 'center', valign: 'middle',
    fontFace: 'Consolas',
  })

  // Human Feedback node (our customization) — amber accent for "human in the loop"
  const hfW = 3.20
  const hfH = 0.65
  const hfX = (SLIDE_W - hfW) / 2
  const hfY = loopBackY + 0.50

  // Shadow/glow behind
  slide.addShape(pres.ShapeType.roundRect, {
    x: hfX - 0.03, y: hfY + 0.03, w: hfW + 0.06, h: hfH,
    fill: { color: C.amber100 }, line: { type: 'none' }, rectRadius: 0.08,
  })

  // Main card
  slide.addShape(pres.ShapeType.roundRect, {
    x: hfX, y: hfY, w: hfW, h: hfH,
    fill: { color: C.amber50 }, line: { color: C.amber500, width: 2 },
    rectRadius: 0.08,
  })

  // Human icon circle on the left
  slide.addShape(pres.ShapeType.ellipse, {
    x: hfX + 0.10, y: hfY + 0.12, w: 0.40, h: 0.40,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })
  slide.addText('H', {
    x: hfX + 0.10, y: hfY + 0.12, w: 0.40, h: 0.40,
    fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle',
    fontFace: 'Georgia',
  })

  // Human Feedback text
  slide.addText(
    [
      { text: isES ? 'Retroalimentación Humana' : 'Human Feedback', options: { fontSize: 11, bold: true, color: C.zinc950, fontFace: 'Georgia', breakLine: true } },
      { text: isES ? 'Reconocer · Silenciar · Ajustar umbrales' : 'Acknowledge · Silence · Tune thresholds', options: { fontSize: 8, color: C.zinc600, fontFace: 'Calibri' } },
    ],
    {
      x: hfX + 0.60, y: hfY + 0.05, w: hfW - 0.70, h: hfH - 0.10,
      align: 'left', valign: 'middle', shrinkText: true,
    }
  )

  // Bidirectional arrows between loop-back line and Human Feedback
  const midX = (perceiveCx + reflectCx) / 2
  // Down arrow (loop → human feedback)
  slide.addShape(pres.ShapeType.downArrow, {
    x: midX - 0.15, y: loopBackY + 0.15, w: 0.10, h: hfY - loopBackY - 0.15,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })
  // Up arrow (human feedback → loop)
  slide.addShape(pres.ShapeType.upArrow, {
    x: midX + 0.05, y: loopBackY + 0.15, w: 0.10, h: hfY - loopBackY - 0.15,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })

  // ════════════════════════════════════════════════════════════════════════
  // ZONE E: USE CASES — 3 TIERS (y: 6.30 – 7.40)
  // ════════════════════════════════════════════════════════════════════════

  // Section label
  slide.addText(isES ? 'CASOS DE USO — 3 TIERS EVOLUTIVOS' : 'USE CASES — 3 EVOLUTIONARY TIERS', {
    x: MARGIN, y: 6.25, w: 6, h: 0.20,
    fontSize: 8, bold: true, color: C.emerald600, align: 'left', valign: 'middle',
    fontFace: 'Consolas',
  })

  const tiers = [
    {
      id: 'traditional',
      title: isES ? 'Tradicional (S1-S2)' : 'Traditional (S1-S2)',
      color: C.zinc500,
      bgColor: C.zinc50,
      cases: isES
        ? ['Conteo de personas', 'Detección de intrusión', 'Monitoreo de cola', 'Disponibilidad de estacionamiento']
        : ['People counting', 'Intrusion detection', 'Queue monitoring', 'Parking availability'],
    },
    {
      id: 'mldl',
      title: isES ? 'ML/DL Moderno (S2-S3)' : 'Modern ML/DL (S2-S3)',
      color: C.amber500,
      bgColor: C.amber50,
      cases: isES
        ? ['Grafiti y vandalismo', 'Objetos abandonados', 'Fuego y humo', 'Resbalones y peligros']
        : ['Graffiti & vandalism', 'Abandoned objects', 'Fire & smoke', 'Slip & hazard detection'],
    },
    {
      id: 'agentic',
      title: isES ? 'Futuro Agéntico (S4)' : 'Agentic Future (S4)',
      color: C.emerald600,
      bgColor: C.emerald50,
      cases: isES
        ? ['Reporte auto-generado', 'Escalada con juez LLM', 'Memoria visual (v2)', 'Malla multicámara (v3)']
        : ['Auto-generated report', 'LLM-judge escalation', 'Visual memory (v2)', 'Multi-camera mesh (v3)'],
    },
  ]

  tiers.forEach((tier, i) => {
    const tx = MARGIN + i * (UC_W + UC_GAP)

    // Tier card with subtle shadow
    slide.addShape(pres.ShapeType.rect, {
      x: tx, y: UC_Y, w: UC_W, h: UC_H,
      fill: { color: tier.bgColor }, line: { color: tier.color, width: 1 },
      shadow: { type: 'outer', blur: 3, offset: 1, color: '000000', opacity: 0.06 },
    })

    // Color bar at top (thicker for emphasis)
    slide.addShape(pres.ShapeType.rect, {
      x: tx, y: UC_Y, w: UC_W, h: 0.06,
      fill: { color: tier.color }, line: { type: 'none' },
    })

    // Tier number badge
    slide.addShape(pres.ShapeType.ellipse, {
      x: tx + 0.12, y: UC_Y + 0.14, w: 0.22, h: 0.22,
      fill: { color: tier.color }, line: { type: 'none' },
    })
    slide.addText(String(i + 1), {
      x: tx + 0.12, y: UC_Y + 0.14, w: 0.22, h: 0.22,
      fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle',
      fontFace: 'Consolas',
    })

    // Tier title
    slide.addText(tier.title, {
      x: tx + 0.42, y: UC_Y + 0.08, w: UC_W - 0.52, h: 0.22,
      fontSize: 9, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    })

    // Tier cases (compact 2-column list)
    const casesText = tier.cases.map((c) => `• ${c}`).join('\n')
    slide.addText(casesText, {
      x: tx + 0.15, y: UC_Y + 0.36, w: UC_W - 0.30, h: 0.50,
      fontSize: 7.5, color: C.zinc700, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.15, shrinkText: true,
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER — value generated callout + sources (y: 7.35 – 7.48)
  // ════════════════════════════════════════════════════════════════════════

  // Value generated label (right-aligned, in emerald)
  slide.addText(
    isES
      ? 'VALOR GENERADO: respuesta automática <2s · evidencia auditable · gobernanza con disyuntor'
      : 'VALUE GENERATED: <2s auto-response · auditable evidence · circuit-breaker governance',
    {
      x: MARGIN, y: 7.35, w: CONTENT_W, h: 0.15,
      fontSize: 7, bold: true, color: C.emerald600, align: 'right', valign: 'middle',
      fontFace: 'Consolas', shrinkText: true,
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
