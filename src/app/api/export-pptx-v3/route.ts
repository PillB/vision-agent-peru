/**
 * /api/export-pptx-v3 — BCP-targeted Z-flow infographic.
 *
 * 4 era cards connected by pentagon arrows (left-to-right flow).
 * Each card: paragraph + capabilities + differential value + BCP use cases.
 * Target: VP de seguridad de sedes BCP con cámaras.
 *
 * Geometry validated by /home/z/my-project/scripts/geometry-engine-v3.py:
 *   ✅ 0 overflow, ✅ 0 overlap, ✅ 0 misaligned arrows.
 *
 * No dates, no money. Peruvian Spanish. 100% native editable shapes.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pptxgen from 'pptxgenjs'
import {
  ERAS_V3, TITLE_ES, VALUE_STRIP_ES, BCP_TARGET_ES, SOURCES_ES, COPYRIGHT_ES,
} from '@/lib/pptx-v3-content'

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

// Card geometry (validated)
const ARROW_W = 0.35
const CARD_W = (CONTENT_W - 3 * ARROW_W) / 4
const CARD_Y = 1.10
const CARD_H = 4.40

const CARD_XS = [0, 1, 2, 3].map((i) => MARGIN + i * (CARD_W + ARROW_W))
const ARROW_XS = [0, 1, 2].map((i) => CARD_XS[i] + CARD_W)
const ARROW_Y = CARD_Y + CARD_H / 2 - 0.25

export async function GET() {
  const locale = await getLocale()
  void locale // content is always Spanish for BCP target; English fallback uses same structure

  const pres = new pptxgen()
  pres.defineLayout({ name: 'CUSTOM_WIDE', width: SLIDE_W, height: SLIDE_H })
  pres.layout = 'CUSTOM_WIDE'
  pres.title = 'Vision Agent — Evolución de IA para Seguridad BCP'
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
  slide.addText('Vision Agent — Evolución de Inteligencia de Video', {
    x: 0.85, y: 0.10, w: 8.5, h: 0.45,
    fontSize: 13, bold: true, color: C.zinc950, align: 'left', valign: 'middle', fontFace: 'Georgia',
  })
  slide.addText('VP Seguridad Sedes BCP  ·  Perú', {
    x: 10.33, y: 0.10, w: 2.7, h: 0.45,
    fontSize: 9, color: C.zinc500, align: 'right', valign: 'middle', fontFace: 'Consolas',
  })
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN, y: 0.60, w: CONTENT_W, h: 0, line: { color: C.zinc200, width: 1 },
  })

  // ═══ ZONE B: TITLE ═══
  slide.addText(TITLE_ES, {
    x: MARGIN, y: 0.65, w: CONTENT_W, h: 0.40,
    fontSize: 14, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
    fontFace: 'Georgia', shrinkText: true,
  })

  // ═══ ZONE C: 4 ERA CARDS + 3 CONNECTOR ARROWS ═══
  ERAS_V3.forEach((era, i) => {
    const cx = CARD_XS[i]

    // Card background
    slide.addShape(pres.ShapeType.roundRect, {
      x: cx, y: CARD_Y, w: CARD_W, h: CARD_H,
      fill: { color: C.white }, line: { color: C.zinc200, width: 1 },
      rectRadius: 0.04,
      shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.08 },
    })

    // Color header bar
    slide.addShape(pres.ShapeType.rect, {
      x: cx, y: CARD_Y, w: CARD_W, h: 0.07,
      fill: { color: era.color }, line: { type: 'none' },
    })

    // Stage number badge
    slide.addShape(pres.ShapeType.ellipse, {
      x: cx + 0.08, y: CARD_Y + 0.10, w: 0.28, h: 0.28,
      fill: { color: era.color }, line: { type: 'none' },
    })
    slide.addText(era.stage, {
      x: cx + 0.08, y: CARD_Y + 0.10, w: 0.28, h: 0.28,
      fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Consolas',
    })

    // Era name
    slide.addText(era.name, {
      x: cx + 0.42, y: CARD_Y + 0.10, w: CARD_W - 0.50, h: 0.28,
      fontSize: 12, bold: true, color: C.zinc950, align: 'left', valign: 'middle',
      fontFace: 'Georgia', shrinkText: true,
    })

    // Paragraph
    slide.addText(era.paragraph, {
      x: cx + 0.10, y: CARD_Y + 0.45, w: CARD_W - 0.20, h: 0.70,
      fontSize: 7.5, color: C.zinc600, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.15, shrinkText: true,
    })

    // Capabilities label
    slide.addText('CAPACIDADES', {
      x: cx + 0.10, y: CARD_Y + 1.20, w: CARD_W - 0.20, h: 0.15,
      fontSize: 6.5, bold: true, color: era.color, align: 'left', valign: 'middle', fontFace: 'Consolas',
    })

    // Capabilities body
    slide.addText(era.capabilities, {
      x: cx + 0.10, y: CARD_Y + 1.36, w: CARD_W - 0.20, h: 0.65,
      fontSize: 7, color: C.zinc700, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.15, shrinkText: true,
    })

    // Differential value label
    slide.addText('VALOR DIFERENCIAL', {
      x: cx + 0.10, y: CARD_Y + 2.05, w: CARD_W - 0.20, h: 0.15,
      fontSize: 6.5, bold: true, color: C.emerald600, align: 'left', valign: 'middle', fontFace: 'Consolas',
    })

    // Differential value body
    slide.addText(era.differentialValue, {
      x: cx + 0.10, y: CARD_Y + 2.21, w: CARD_W - 0.20, h: 0.55,
      fontSize: 7.5, italic: true, color: C.zinc800, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.15, shrinkText: true,
    })

    // BCP use cases label
    slide.addText('CASOS DE USO BCP', {
      x: cx + 0.10, y: CARD_Y + 2.80, w: CARD_W - 0.20, h: 0.15,
      fontSize: 6.5, bold: true, color: C.zinc500, align: 'left', valign: 'middle', fontFace: 'Consolas',
    })

    // BCP use cases body
    const ucText = era.bcpUseCases.map((uc) => `• ${uc}`).join('\n')
    slide.addText(ucText, {
      x: cx + 0.10, y: CARD_Y + 2.96, w: CARD_W - 0.20, h: 1.35,
      fontSize: 7, color: C.zinc700, align: 'left', valign: 'top', fontFace: 'Calibri',
      lineSpacingMultiple: 1.2, shrinkText: true,
    })
  })

  // 3 connector arrows (pentagon shapes between cards)
  for (let i = 0; i < 3; i++) {
    slide.addShape(pres.ShapeType.pentagon, {
      x: ARROW_XS[i], y: ARROW_Y, w: ARROW_W, h: 0.50,
      fill: { color: C.emerald600 }, line: { type: 'none' },
      shadow: { type: 'outer', blur: 2, offset: 1, color: '059669', opacity: 0.3 },
    })
  }

  // ═══ ZONE D: VALUE STRIP ═══
  slide.addShape(pres.ShapeType.rect, {
    x: MARGIN, y: 5.55, w: CONTENT_W, h: 0.45,
    fill: { color: C.emerald50 }, line: { color: C.emerald600, width: 1 },
  })
  slide.addText(VALUE_STRIP_ES, {
    x: MARGIN + 0.15, y: 5.58, w: CONTENT_W - 0.30, h: 0.39,
    fontSize: 8, bold: true, color: C.zinc800, align: 'center', valign: 'middle',
    fontFace: 'Calibri', shrinkText: true,
  })

  // ═══ ZONE E: FOOTER ═══
  // BCP target line
  slide.addText(BCP_TARGET_ES, {
    x: MARGIN, y: 6.10, w: 6.0, h: 0.25,
    fontSize: 7.5, bold: true, color: C.emerald600, align: 'left', valign: 'middle', fontFace: 'Consolas',
  })

  // Sources
  slide.addText(SOURCES_ES, {
    x: MARGIN, y: 6.38, w: CONTENT_W, h: 0.25,
    fontSize: 6.5, color: C.zinc400, align: 'left', valign: 'middle', fontFace: 'Consolas',
    shrinkText: true,
  })

  // Footer line
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN, y: 6.70, w: CONTENT_W, h: 0, line: { color: C.zinc200, width: 1 },
  })

  // Copyright
  slide.addText(COPYRIGHT_ES, {
    x: MARGIN, y: 7.05, w: CONTENT_W, h: 0.25,
    fontSize: 6.5, color: C.zinc400, align: 'left', valign: 'middle', fontFace: 'Consolas',
    shrinkText: true,
  })

  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Uint8Array
  return new NextResponse(buffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': 'attachment; filename="vision-agent-bcp-evolution.pptx"',
      'Content-Length': buffer.length.toString(),
    },
  })
}
