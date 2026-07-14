/**
 * /api/export-pptx — Generates a SINGLE PowerPoint slide with native objects.
 *
 * Slide geometry: 13.333" × 7.5" (16:9 widescreen = 12192000 × 6858000 EMU).
 *
 * Layout map (all measurements in inches, verified against occlusion + overflow):
 *
 *   x=0.3" ←── margin ──→ x=13.03"   (content width = 12.73")
 *
 *   y=0.15" ┌─────────────────────────────────────────────────────────────┐
 *           │ [CV logo]  Cusco Vision Agent — Strategic Brief   v1.0 ... │ h=0.5"
 *   y=0.65" ├─────────────────────────────────────────────────────────────┤
 *           │                                                             │
 *   y=0.75" │  "AI has crossed four thresholds in 70 years — and the     │ h=0.6"
 *           │   fourth, agentic systems, finally acts on the world."     │
 *   y=1.35" ├─────────────────────────────────────────────────────────────┤
 *           │                                                             │
 *   y=1.5"  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
 *           │  │Stage 1 │  │Stage 2 │  │Stage 3 │  │Stage 4 │            │ h=3.5"
 *           │  │Static  │  │ML/DL   │  │GenAI   │  │Agentic │            │
 *           │  │Programs│  │        │  │        │  │AI      │            │
 *   y=5.0"  │  └────────┘  └────────┘  └────────┘  └────────┘            │
 *           │  ◄─────── 1956 ──── 70 years ──── 2025 ────────►            │ h=0.3"
 *   y=5.45" │                                                             │
 *           │  ┌─ THE LEAP: Agentic AI adds the loop ──────────────────┐  │ h=1.0"
 *   y=5.55" │  │ perceive → reason → act → reflect                     │  │
 *           │  │ Reactive→Proactive · Single→Multi · Tool→Collaborator │  │
 *   y=6.55" │  │ Cusco Vision Agent operates at Stage 4 (L5 autonomy)  │  │
 *           │  └────────────────────────────────────────────────────────┘  │
 *   y=6.65" ├─────────────────────────────────────────────────────────────┤
 *           │  Sources: McKinsey · BCG · Bain · Gartner · Deloitte ...   │ h=0.3"
 *   y=7.3"  └─────────────────────────────────────────────────────────────┘
 *
 * Card measurements:
 *   card_w = (12.73 - 3×0.17) / 4 = 3.055" per card
 *   Card 1: x=0.30   Card 2: x=3.525   Card 3: x=6.750   Card 4: x=9.975
 *   Card internal layout (relative to card top-left):
 *     color bar:  0.00 → 0.08"  (top accent)
 *     header:     0.15 → 0.85"  (stage number + name + era)
 *     definition: 0.90 → 1.55"  (2-line description)
 *     can-do:     1.60 → 2.55"  (bullets)
 *     value box:  2.60 → 3.40"  (value created)
 *
 * All objects are NATIVE PowerPoint shapes/text boxes (fully editable).
 * Zero embedded raster images — everything is vector/text.
 */

import { NextResponse } from 'next/server'
import pptxgen from 'pptxgenjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Color palette (hex without #, per pptxgenjs convention) ───────────────
const C = {
  emerald600: '059669',
  emerald50: 'ECFDF5',
  zinc950: '09090B',
  zinc700: '27272A',
  zinc600: '52525B',
  zinc500: '71717A',
  zinc400: 'A1A1AA',
  zinc200: 'E4E4E7',
  zinc100: 'F4F4F5',
  amber500: 'F59E0B',
  rose600: 'E11D48',
  white: 'FFFFFF',
}

// ─── Stage data (trimmed for PPTX text-fitting) ─────────────────────────────
interface PptxStage {
  n: number
  name: string
  era: string
  def: string
  can: string[]
  value: string
  color: string // hex
}

const STAGES: PptxStage[] = [
  {
    n: 1,
    name: 'Static Programs',
    era: '1956 – 1980s',
    def: 'Humans encode rules; system executes deterministic logic.',
    can: ['Audit every step', 'Machine speed', 'Never drifts'],
    value: 'Scalable bounded automation',
    color: C.zinc400,
  },
  {
    n: 2,
    name: 'ML / Deep Learning',
    era: '1986 – 2017',
    def: 'Models learn patterns from data — no human writes rules.',
    can: ['Perceive images, speech', 'Detect anomalies', 'Improve with data'],
    value: 'Perception at scale — 2010s AI economy',
    color: C.zinc600,
  },
  {
    n: 3,
    name: 'Cognitive / GenAI',
    era: '2017 – 2023',
    def: 'Models synthesize content from internet-scale training.',
    can: ['Generate text, code, images', 'Summarize & translate', 'Reason shallowly'],
    value: '$33.9B invested 2024; 78% orgs use AI',
    color: C.amber500,
  },
  {
    n: 4,
    name: 'Agentic AI',
    era: '2024 – present',
    def: 'Systems that perceive, reason, act, self-correct in a loop.',
    can: ['Plan multi-step workflows', 'Use tools & APIs', 'Self-correct on failure'],
    value: 'End-to-end process execution',
    color: C.emerald600,
  },
]

// ─── Layout constants (inches) ──────────────────────────────────────────────
const SLIDE_W = 13.333
const SLIDE_H = 7.5
const MARGIN = 0.3
const CONTENT_W = SLIDE_W - 2 * MARGIN // 12.733"

const CARD_GAP = 0.17
const CARD_W = (CONTENT_W - 3 * CARD_GAP) / 4 // 3.055"
const CARD_H = 3.5
const CARD_Y = 1.5

const CARD_XS = [0, 1, 2, 3].map((i) => MARGIN + i * (CARD_W + CARD_GAP))
// = [0.30, 3.525, 6.750, 9.975]

export async function GET() {
  const pres = new pptxgen()
  pres.defineLayout({ name: 'CUSTOM_WIDE', width: SLIDE_W, height: SLIDE_H })
  pres.layout = 'CUSTOM_WIDE'
  pres.title = 'Cusco Vision Agent — Strategic Brief'
  pres.author = 'Cusco Vision Agent'
  pres.company = 'Z.ai'

  const slide = pres.addSlide()
  slide.background = { color: C.white }

  // ════════════════════════════════════════════════════════════════════════
  // HEADER (y: 0.15" – 0.65")
  // ════════════════════════════════════════════════════════════════════════

  // Logo: emerald rounded rectangle with "CV" text
  slide.addShape(pres.ShapeType.roundRect, {
    x: MARGIN,
    y: 0.15,
    w: 0.5,
    h: 0.5,
    fill: { color: C.emerald600 },
    line: { type: 'none' },
    rectRadius: 0.08,
  })
  slide.addText('CV', {
    x: MARGIN,
    y: 0.15,
    w: 0.5,
    h: 0.5,
    fontSize: 16,
    bold: true,
    color: C.white,
    align: 'center',
    valign: 'middle',
    fontFace: 'Georgia',
  })

  // Brand title
  slide.addText('Cusco Vision Agent — Strategic Brief', {
    x: MARGIN + 0.65,
    y: 0.15,
    w: 8.5,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color: C.zinc950,
    align: 'left',
    valign: 'middle',
    fontFace: 'Georgia',
  })

  // Meta tag (right-aligned)
  slide.addText('v1.0  ·  2026-07-14  ·  Peru', {
    x: SLIDE_W - MARGIN - 3.0,
    y: 0.15,
    w: 3.0,
    h: 0.5,
    fontSize: 9,
    color: C.zinc500,
    align: 'right',
    valign: 'middle',
    fontFace: 'Consolas',
  })

  // Header separator line
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN,
    y: 0.72,
    w: CONTENT_W,
    h: 0,
    line: { color: C.zinc200, width: 1 },
  })

  // ════════════════════════════════════════════════════════════════════════
  // MAIN TITLE (y: 0.80" – 1.40")
  // ════════════════════════════════════════════════════════════════════════
  slide.addText(
    'AI has crossed four thresholds in 70 years — and the fourth, agentic systems, finally acts on the world.',
    {
      x: MARGIN,
      y: 0.80,
      w: CONTENT_W,
      h: 0.60,
      fontSize: 20,
      bold: true,
      color: C.zinc950,
      align: 'left',
      valign: 'middle',
      fontFace: 'Georgia',
    }
  )

  // ════════════════════════════════════════════════════════════════════════
  // 4 STAGE CARDS (y: 1.50" – 5.00")
  // ════════════════════════════════════════════════════════════════════════
  STAGES.forEach((stage, i) => {
    const cx = CARD_XS[i]

    // — Card background (white with border) —
    slide.addShape(pres.ShapeType.rect, {
      x: cx,
      y: CARD_Y,
      w: CARD_W,
      h: CARD_H,
      fill: { color: C.white },
      line: { color: C.zinc200, width: 1 },
      shadow: { type: 'outer', blur: 3, offset: 1, color: '000000', opacity: 0.08 },
    })

    // — Color bar at top (stage accent) —
    slide.addShape(pres.ShapeType.rect, {
      x: cx,
      y: CARD_Y,
      w: CARD_W,
      h: 0.08,
      fill: { color: stage.color },
      line: { type: 'none' },
    })

    // — Stage number + name + era (header block) —
    // Internal y offsets: 0.15 → 0.85 (h=0.70)
    slide.addText(
      [
        {
          text: `STAGE ${stage.n}`,
          options: {
            fontSize: 8,
            color: C.zinc400,
            fontFace: 'Consolas',
            breakLine: true,
          },
        },
        {
          text: stage.name,
          options: {
            fontSize: 13,
            bold: true,
            color: C.zinc950,
            fontFace: 'Georgia',
            breakLine: true,
          },
        },
        {
          text: stage.era,
          options: {
            fontSize: 8,
            color: C.zinc500,
            fontFace: 'Consolas',
          },
        },
      ],
      {
        x: cx + 0.15,
        y: CARD_Y + 0.18,
        w: CARD_W - 0.30,
        h: 0.70,
        align: 'left',
        valign: 'top',
      }
    )

    // — Definition (y offset: 0.95 → 1.55, h=0.60) —
    slide.addText(stage.def, {
      x: cx + 0.15,
      y: CARD_Y + 0.95,
      w: CARD_W - 0.30,
      h: 0.60,
      fontSize: 9,
      color: C.zinc600,
      align: 'left',
      valign: 'top',
      fontFace: 'Calibri',
    })

    // — "Can do" label + bullets (y offset: 1.60 → 2.55, h=0.95) —
    slide.addText(
      [
        {
          text: 'CAN DO',
          options: {
            fontSize: 7,
            bold: true,
            color: C.emerald600,
            fontFace: 'Consolas',
            breakLine: true,
          },
        },
        ...stage.can.map((c) => ({
          text: `✓  ${c}`,
          options: {
            fontSize: 9,
            color: C.zinc700,
            fontFace: 'Calibri',
            breakLine: true,
          },
        })),
      ],
      {
        x: cx + 0.15,
        y: CARD_Y + 1.62,
        w: CARD_W - 0.30,
        h: 1.00,
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 1.15,
      }
    )

    // — Value box (y offset: 2.65 → 3.40, h=0.75) —
    const valueBoxY = CARD_Y + 2.65
    const valueBoxH = 0.75
    slide.addShape(pres.ShapeType.rect, {
      x: cx + 0.12,
      y: valueBoxY,
      w: CARD_W - 0.24,
      h: valueBoxH,
      fill: { color: C.zinc100 },
      line: { type: 'none' },
    })
    slide.addText(
      [
        {
          text: 'VALUE CREATED',
          options: {
            fontSize: 7,
            bold: true,
            color: C.zinc400,
            fontFace: 'Consolas',
            breakLine: true,
          },
        },
        {
          text: stage.value,
          options: {
            fontSize: 9,
            color: C.zinc950,
            fontFace: 'Calibri',
          },
        },
      ],
      {
        x: cx + 0.20,
        y: valueBoxY + 0.06,
        w: CARD_W - 0.40,
        h: valueBoxH - 0.12,
        align: 'left',
        valign: 'top',
      }
    )
  })

  // ════════════════════════════════════════════════════════════════════════
  // TIMELINE ARROW (y: 5.12" – 5.42")
  // ════════════════════════════════════════════════════════════════════════
  slide.addShape(pres.ShapeType.rightArrow, {
    x: MARGIN,
    y: 5.12,
    w: CONTENT_W,
    h: 0.30,
    fill: { color: C.zinc100 },
    line: { color: C.zinc200, width: 1 },
  })
  slide.addText(
    '1956 — Dartmouth Workshop     ────  70 years  ────     2025 — Agentic AI at Peak of Expectations',
    {
      x: MARGIN,
      y: 5.12,
      w: CONTENT_W,
      h: 0.30,
      fontSize: 9,
      color: C.zinc600,
      align: 'center',
      valign: 'middle',
      fontFace: 'Consolas',
    }
  )

  // ════════════════════════════════════════════════════════════════════════
  // INSIGHT CALLOUT (y: 5.55" – 6.55")
  // ════════════════════════════════════════════════════════════════════════
  const calloutY = 5.55
  const calloutH = 1.00

  // Callout background (emerald-50 with emerald border)
  slide.addShape(pres.ShapeType.rect, {
    x: MARGIN,
    y: calloutY,
    w: CONTENT_W,
    h: calloutH,
    fill: { color: C.emerald50 },
    line: { color: C.emerald600, width: 1 },
  })

  // Left accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: MARGIN,
    y: calloutY,
    w: 0.06,
    h: calloutH,
    fill: { color: C.emerald600 },
    line: { type: 'none' },
  })

  // Callout text (3 lines)
  slide.addText(
    [
      {
        text: 'THE LEAP:  ',
        options: {
          fontSize: 11,
          bold: true,
          color: C.emerald600,
          fontFace: 'Consolas',
        },
      },
      {
        text: 'Agentic AI adds the loop — ',
        options: {
          fontSize: 11,
          color: C.zinc950,
          fontFace: 'Georgia',
        },
      },
      {
        text: 'perceive → reason → act → reflect',
        options: {
          fontSize: 11,
          italic: true,
          color: C.emerald600,
          fontFace: 'Georgia',
          breakLine: true,
        },
      },
      {
        text: 'Reactive → Proactive  ·  Single-shot → Multi-step  ·  Answering → Executing  ·  Tool → Collaborator',
        options: {
          fontSize: 9,
          color: C.zinc600,
          fontFace: 'Calibri',
          breakLine: true,
        },
      },
      {
        text: 'Cusco Vision Agent operates at Stage 4 (L5 autonomy)',
        options: {
          fontSize: 9,
          bold: true,
          color: C.zinc950,
          fontFace: 'Calibri',
        },
      },
      {
        text: '  —  perceive plaza → reason on anomalies → act via 3-tier escalation → reflect via LLM judge',
        options: {
          fontSize: 9,
          color: C.zinc600,
          fontFace: 'Calibri',
        },
      },
    ],
    {
      x: MARGIN + 0.25,
      y: calloutY + 0.10,
      w: CONTENT_W - 0.50,
      h: calloutH - 0.20,
      align: 'left',
      valign: 'top',
      lineSpacingMultiple: 1.2,
    }
  )

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER (y: 6.70" – 7.30")
  // ════════════════════════════════════════════════════════════════════════

  // Footer separator line
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN,
    y: 6.68,
    w: CONTENT_W,
    h: 0,
    line: { color: C.zinc200, width: 1 },
  })

  // Sources
  slide.addText(
    'Sources: McKinsey · BCG · Bain · Gartner · Deloitte · WEF · Stanford HAI · MIT Sloan · Sequoia · VastData  ·  2024–2025',
    {
      x: MARGIN,
      y: 6.75,
      w: CONTENT_W,
      h: 0.25,
      fontSize: 8,
      color: C.zinc400,
      align: 'left',
      valign: 'middle',
      fontFace: 'Consolas',
    }
  )

  // Copyright
  slide.addText('Cusco Vision Agent v1.0  ·  Agentic Camera Intelligence for Peru  ·  2026-07-14', {
    x: MARGIN,
    y: 7.02,
    w: CONTENT_W,
    h: 0.25,
    fontSize: 8,
    color: C.zinc400,
    align: 'left',
    valign: 'middle',
    fontFace: 'Consolas',
  })

  // ════════════════════════════════════════════════════════════════════════
  // GENERATE
  // ════════════════════════════════════════════════════════════════════════
  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': 'attachment; filename="cusco-vision-agent-strategic-brief.pptx"',
      'Content-Length': buffer.length.toString(),
    },
  })
}
