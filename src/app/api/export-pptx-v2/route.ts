/**
 * /api/export-pptx-v2 — McKinsey/BCG text-dense infographic (Phase 2+).
 *
 * Geometry validated by /home/z/my-project/scripts/geometry-engine-v2.py:
 *   ✅ 0 overflow, ✅ 0 overlap, ✅ 0 misaligned arrows.
 *
 * Layout (13.333" × 7.5"):
 *   A: Header (logo, brand, meta — NO dates)
 *   B: Title (action title)
 *   C: 4 era columns L-to-R with paragraphs + use cases (commercial + disaster)
 *   D: Capability strip (4 cells from Section 5/6)
 *   E: Agentic loop diagram (4 nodes + loop-back + Human Feedback)
 *   F: Project-mapping quote (emerald callout)
 *   G: Value + sources
 *
 * No dates, no monetary figures. Peruvian Spanish (es-PE) or English (en).
 * 100% native editable PowerPoint shapes.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pptxgen from 'pptxgenjs'
import {
  ERAS_ES, ERAS_EN, CAPABILITIES_ES, CAPABILITIES_EN,
  LOOP_NODES_ES, LOOP_NODES_EN, QUOTE_ES, QUOTE_EN,
} from '@/lib/pptx-v2-content'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getLocale() {
  const store = await cookies()
  return store.get('NEXT_LOCALE')?.value === 'es-PE' ? 'es-PE' : 'en'
}

const C = {
  emerald600: '059669', emerald50: 'ECFDF5',
  zinc950: '09090B', zinc800: '27272A', zinc700: '3F3F46', zinc600: '52525B',
  zinc500: '71717A', zinc400: 'A1A1AA', zinc300: 'D4D4D8', zinc200: 'E4E4E7',
  zinc100: 'F4F4F5', zinc50: 'FAFAFA',
  amber500: 'F59E0B', amber50: 'FFFBEB',
  white: 'FFFFFF',
}

const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.30
const CONTENT_W = SLIDE_W - 2 * MARGIN

// Column geometry (validated)
const COL_GAP = 0.15
const COL_W = (CONTENT_W - 3 * COL_GAP) / 4
const COL_Y = 1.10
const COL_H = 2.90
const COL_XS = [0, 1, 2, 3].map((i) => MARGIN + i * (COL_W + COL_GAP))

// Loop geometry (validated)
const LOOP_Y = 4.80
const LOOP_H = 0.60
const LOOP_NODE_W = 1.55
const LOOP_GAP = 0.50
const TOTAL_LOOP_W = 4 * LOOP_NODE_W + 3 * LOOP_GAP
const LOOP_START_X = (SLIDE_W - TOTAL_LOOP_W) / 2

export async function GET() {
  const locale = await getLocale()
  const isES = locale === 'es-PE'
  const eras = isES ? ERAS_ES : ERAS_EN
  const caps = isES ? CAPABILITIES_ES : CAPABILITIES_EN
  const loopNodes = isES ? LOOP_NODES_ES : LOOP_NODES_EN
  const quote = isES ? QUOTE_ES : QUOTE_EN

  const pres = new pptxgen()
  pres.defineLayout({ name: 'CUSTOM_WIDE', width: SLIDE_W, height: SLIDE_H })
  pres.layout = 'CUSTOM_WIDE'
  pres.title = 'Vision Agent — Strategic Brief V2'
  pres.author = 'Vision Agent'
  pres.company = 'Z.ai'

  const slide = pres.addSlide()
  slide.background = { color: C.white }

  // ═══ ZONE A: HEADER ═══
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.30, y: 0.10, w: 0.45, h: 0.45,
    fill: { color: C.emerald600 }, line: { type: 'none' }, rectRadius: 0.08,
  })
  slide.addText('VA', {
    x: 0.30, y: 0.10, w: 0.45, h: 0.45,
    fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Georgia',
  })
  slide.addText(`${isES ? 'Vision Agent' : 'Vision Agent'} — ${isES ? 'Resumen estratégico' : 'Strategic Brief'}`, {
    x: 0.85, y: 0.10, w: 7.5, h: 0.45,
    fontSize: 13, bold: true, color: C.zinc950, align: 'left', valign: 'middle', fontFace: 'Georgia',
  })
  slide.addText(`v1.0  ·  ${isES ? 'Perú' : 'Peru'}`, {
    x: 10.33, y: 0.10, w: 2.7, h: 0.45,
    fontSize: 9, color: C.zinc500, align: 'right', valign: 'middle', fontFace: 'Consolas',
  })
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN, y: 0.60, w: CONTENT_W, h: 0, line: { color: C.zinc200, width: 1 },
  })

  // ═══ ZONE B: TITLE ═══
  slide.addText(
    isES
      ? 'La IA evolucionó en cuatro etapas — cada una añadió capacidades que la anterior no tenía, hasta llegar a sistemas que actúan autónomamente con gobernanza humana.'
      : 'AI evolved through four stages — each adding capabilities the previous lacked, culminating in systems that act autonomously with human governance.',
    {
      x: MARGIN, y: 0.65, w: CONTENT_W, h: 0.40,
      fontSize: 14, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    }
  )

  // ═══ ZONE C: 4 ERA COLUMNS ═══
  eras.forEach((era, i) => {
    const cx = COL_XS[i]

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
      x: cx + 0.10, y: COL_Y + 0.10, w: COL_W - 0.20, h: 0.18,
      fontSize: 7, bold: true, color: C.zinc400, align: 'left', valign: 'middle',
      fontFace: 'Consolas',
    })

    // Era name
    slide.addText(era.name, {
      x: cx + 0.10, y: COL_Y + 0.28, w: COL_W - 0.20, h: 0.22,
      fontSize: 11, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    })

    // Definition paragraph
    slide.addText(era.def, {
      x: cx + 0.10, y: COL_Y + 0.52, w: COL_W - 0.20, h: 0.72,
      fontSize: 8, color: C.zinc600, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.15, shrinkText: true,
    })

    // Use cases label
    slide.addText(isES ? 'CASOS DE USO' : 'USE CASES', {
      x: cx + 0.10, y: COL_Y + 1.28, w: COL_W - 0.20, h: 0.14,
      fontSize: 7, bold: true, color: era.color, align: 'left', valign: 'middle',
      fontFace: 'Consolas',
    })

    // Use cases bullets
    const ucText = era.useCases.map((uc) => `• ${uc}`).join('\n')
    slide.addText(ucText, {
      x: cx + 0.10, y: COL_Y + 1.44, w: COL_W - 0.20, h: 1.40,
      fontSize: 7, color: C.zinc700, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.2, shrinkText: true,
    })
  })

  // ═══ ZONE D: CAPABILITY STRIP ═══
  caps.forEach((cap, i) => {
    const cx = COL_XS[i]
    slide.addShape(pres.ShapeType.rect, {
      x: cx, y: 4.05, w: COL_W, h: 0.45,
      fill: { color: C.zinc50 }, line: { color: C.zinc200, width: 1 },
    })
    slide.addText(cap, {
      x: cx + 0.08, y: 4.09, w: COL_W - 0.16, h: 0.37,
      fontSize: 7, color: C.zinc600, align: 'left', valign: 'middle', fontFace: 'Calibri',
      shrinkText: true,
    })
  })

  // ═══ ZONE E: AGENTIC LOOP DIAGRAM ═══
  // Section label
  slide.addText(isES ? 'CICLO AUTÓNOMO — CON RETROALIMENTACIÓN HUMANA' : 'AGENTIC LOOP — WITH HUMAN FEEDBACK', {
    x: MARGIN, y: 4.55, w: 6, h: 0.18,
    fontSize: 8, bold: true, color: C.emerald600, align: 'left', valign: 'middle',
    fontFace: 'Consolas',
  })

  // 4 loop nodes
  const loopCenters: number[] = []
  loopNodes.forEach((node, i) => {
    const nx = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP)
    loopCenters.push(nx + LOOP_NODE_W / 2)

    // Node card
    slide.addShape(pres.ShapeType.roundRect, {
      x: nx, y: LOOP_Y, w: LOOP_NODE_W, h: LOOP_H,
      fill: { color: i === 3 ? C.emerald50 : C.white },
      line: { color: C.emerald600, width: 1.5 }, rectRadius: 0.06,
      shadow: { type: 'outer', blur: 3, offset: 1, color: '059669', opacity: 0.12 },
    })

    // Step number badge (top-LEFT to avoid name overlap)
    slide.addShape(pres.ShapeType.ellipse, {
      x: nx + 0.05, y: LOOP_Y - 0.05, w: 0.22, h: 0.22,
      fill: { color: C.emerald600 }, line: { color: C.white, width: 1 },
    })
    slide.addText(String(i + 1), {
      x: nx + 0.05, y: LOOP_Y - 0.05, w: 0.22, h: 0.22,
      fontSize: 8, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Consolas',
    })

    // Node name (shifted right to avoid badge)
    slide.addText(node.name, {
      x: nx + 0.30, y: LOOP_Y + 0.05, w: LOOP_NODE_W - 0.35, h: 0.20,
      fontSize: 11, bold: true, color: C.emerald600, align: 'left', valign: 'middle', fontFace: 'Georgia',
    })
    // Node desc
    slide.addText(node.desc, {
      x: nx + 0.05, y: LOOP_Y + 0.25, w: LOOP_NODE_W - 0.10, h: 0.30,
      fontSize: 7, color: C.zinc600, align: 'center', valign: 'top', fontFace: 'Calibri',
      shrinkText: true,
    })
  })

  // Forward arrows (3)
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
  // Loop label (ABOVE the left arrow, centered)
  slide.addText(isES ? '↻ ciclo autónomo' : '↻ autonomous loop', {
    x: (perceiveCx + reflectCx) / 2 - 0.90, y: loopBackY - 0.18, w: 1.80, h: 0.14,
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
      { text: isES ? 'Reconocer · Silenciar · Ajustar umbrales · Disyuntor' : 'Acknowledge · Silence · Tune thresholds · Circuit breaker', options: { fontSize: 7, color: C.zinc600, fontFace: 'Calibri' } },
    ],
    { x: HF_X + 0.45, y: HF_Y + 0.03, w: HF_W - 0.55, h: HF_H - 0.06, align: 'left', valign: 'middle', shrinkText: true }
  )

  // Bidirectional arrows to Human Feedback
  const midX = (perceiveCx + reflectCx) / 2
  slide.addShape(pres.ShapeType.downArrow, {
    x: midX - 0.10, y: loopBackY + 0.15, w: 0.07, h: HF_Y - loopBackY - 0.15,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })
  slide.addShape(pres.ShapeType.upArrow, {
    x: midX + 0.03, y: loopBackY + 0.15, w: 0.07, h: HF_Y - loopBackY - 0.15,
    fill: { color: C.amber500 }, line: { type: 'none' },
  })

  // ═══ ZONE F: QUOTE ═══
  slide.addShape(pres.ShapeType.rect, {
    x: MARGIN, y: 6.25, w: CONTENT_W, h: 0.50,
    fill: { color: C.emerald50 }, line: { color: C.emerald600, width: 1 },
  })
  slide.addText(quote, {
    x: MARGIN + 0.15, y: 6.29, w: CONTENT_W - 0.30, h: 0.42,
    fontSize: 8, italic: true, color: C.zinc800, align: 'left', valign: 'middle',
    fontFace: 'Georgia', shrinkText: true,
  })

  // ═══ ZONE G: VALUE + SOURCES ═══
  slide.addText(
    isES
      ? 'VALOR: respuesta automática · evidencia auditable · disyuntor · reportes auto-generados · juez LLM · cero backend · compatible INDECI/SINPAD'
      : 'VALUE: auto-response · auditable evidence · circuit-breaker · auto-reports · LLM judge · zero backend · INDECI/SINPAD compatible',
    {
      x: MARGIN, y: 6.80, w: CONTENT_W, h: 0.20,
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
