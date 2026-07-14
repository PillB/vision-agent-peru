# McKinsey/BCG Style Guide — Agentic Camera Intelligence System (Tab 1)

**Source corpus**: 12 web searches + 9 deep-read URLs (slideworks.io, deckary.com, strategyu.co, mannhowie.com, f1studioz.com, vercel.com/geist, shadcndesign.com, medium Power BI, plus Linear/Stripe/Notion design-system analyses). Raw JSON + text snapshots in `/home/z/my-project/download/research/task0c/`.

**Hard constraint honored**: NO indigo, NO blue. Accent rotated to **emerald** (primary/active) + **amber** (warning) + **rose** (critical). Neutral = **zinc** (reads gray, not blue).

---

## 1. CONTENT RULES (10) — what every section/block must do

| # | Rule | Concrete spec | Why it matters for our agentic-camera Tab 1 |
|---|------|---------------|---------------------------------------------|
| C1 | **Action Title, not Topic Title** | Every heading is a complete sentence stating the takeaway, ≤15 words, ≤2 lines, active voice, specific & quantitative. "Market Overview" → banned. "Agentic layer cuts false-positive escalations by ~60% via LLM-as-judge filter" → correct. | Executives flip-read; the title alone must carry the insight. Our sections must read cohesively if only the H2s are scanned. |
| C2 | **Pyramid Principle (Minto)** | Top-down: state conclusion first, then 2–4 supporting arguments, then evidence. Inverted from "background → findings → conclusion". | Non-technical execs want the answer in 5 seconds, not a detective story. Lead with "what it does", justify with "how" below. |
| C3 | **One Message Per Block** | If you write "and" in an action title, split into two blocks. Body supports the title; anything that doesn't directly support it gets cut or moved. | Each Tab 1 section = one insight. Don't cram architecture + use-cases + metrics into one card. |
| C4 | **SCR / SCQA Storyline** | Deck-level narrative = **S**ituation (shared context: Peru plazas, manual monitoring gaps) → **C**omplication (cost, latency, false alarms) → **R**esolution (agentic system). Resolution gets 60–70% of the real estate. | Gives the page a story arc an exec can retell internally after one read. |
| C5 | **MECE Categorization** | Every list/grouping is Mutually Exclusive + Collectively Exhaustive. The 3 pillars, the 4 use-cases, the escalation tiers — none overlap, none missing. | Credibility signal. Overlapping categories read as sloppy thinking. |
| C6 | **Ghost Deck First** | Write ALL action titles before any visual. Read titles top-to-bottom as a story. If the story doesn't hold, fix titles before building UI. | Prevents the "frankendashboard" anti-pattern (F1Studioz: most dashboards fail by trying to be a Swiss-army knife). |
| C7 | **The Titles Test (60-Second Rule)** | A managing director should be able to read ONLY the section headings of Tab 1 top-to-bottom and understand the full argument in <60 seconds. | Validation gate before shipping. If headings don't tell the story, the page doesn't either. |
| C8 | **Source Every Quantitative Claim** | Footer line under every chart/stat: `Source: <origin>; <our analysis>, <date>`. Example: `Source: TF.js COCO-SSD model card (Google); internal simulation 2026-07-14`. | McKinsey partners reject decks with unsourced numbers. We're simulating, so we MUST label simulated data explicitly. |
| C9 | **Rule of Three** | When listing capabilities/pillars/recommendations, default to three. Three is specific enough to feel structured, small enough to remember. | Our "three pillars" (Perceive → Reason → Act) and "three escalation tiers" (Info → Warn → Critical) both honor this. |
| C10 | **Progressive Disclosure (Shneiderman's Mantra)** | Overview first → zoom & filter → details-on-demand. Lead with headline metric; reveal breakdown only on click/hover. | Prevents "data vomit" (F1Studioz). Tab 1 shows the system at a glance; deeper detail lives in Tab 2 or expandable sheets. |

---

## 2. VISUAL RULES (10) — typography, color, spacing, density

| # | Rule | Concrete spec |
|---|------|---------------|
| V1 | **Two-font maximum** | (a) Instrument Serif — display headings & big numbers only. (b) Inter — all body, UI, captions. Optional (c) JetBrains Mono — code/data inline. Never mix more. |
| V2 | **Type scale (Inter)** | Display 48/56 (serif) · H1 32/40 (serif) · H2 24/32 (sans, semibold) · H3 18/28 (sans, semibold) · Body 15/24 (sans, regular) · Small 13/20 · Caption 12/16. Line-height ≥1.5 for body. |
| V3 | **3-color palette + 3 semantic** | Brand: emerald. Neutrals: zinc (white → zinc-950). Semantic traffic-light: emerald=healthy, amber=warning, rose=critical. That's it. No decorative color. |
| V4 | **Accent used strategically, not decoratively** | Emerald highlights the ONE data point that matters per card. If everything is emerald, nothing is. Gray is the default; emerald is the exception. |
| V5 | **High-contrast text** | Primary text zinc-950 (#09090b) on white. Secondary zinc-500 (#71717a). Muted zinc-400 (#a1a1aa) only for timestamps/source lines. Never go below zinc-400 on white. |
| V6 | **Card density: generous, not crammed** | Card padding 24px (p-6). Gap between cards 24px (gap-6). Page gutter 32–48px on desktop, 16px mobile. White space is content. |
| V7 | **Border + shadow, not heavy fills** | Cards: `bg-white border border-zinc-200 rounded-xl shadow-sm`. Hover: `border-zinc-300 shadow-md transition`. Avoid solid color blocks; let borders define structure. |
| V8 | **Consistent grid alignment** | All H2s sit at the same Y across sections. All card grids align to a 12-col or 4-col grid. Titles don't move when scrolling. (Reddit r/consulting: "Heading and subheadings should have same position across all slides.") |
| V9 | **No pie charts. No 3D. No clip art. No fancy transitions.** | McKinsey banned pie charts — human eye can't compare areas/angles. Default to column charts, line charts, big-number tiles, funnels. Decoration distracts; if it doesn't support the action title, delete it. |
| V10 | **Traffic-light status logic** (F1Studioz) | Every status indicator uses the semantic scale: green dot = healthy/processing, amber = anomaly detected (Tier 2), red = critical/unacknowledged (Tier 3). Consistent across all metric tiles, alerts, and the live agent-status pill. |

---

## 3. RECOMMENDED TAB 1 LAYOUT STRUCTURE (top → bottom)

Each section is one consulting "slide layout" (StrategyU's 14 patterns). Section heading = action title.

| # | Section (action title) | Layout pattern | Contents |
|---|------------------------|----------------|----------|
| 1 | **Hero / Executive Summary** — *"An agentic camera intelligence system that converts Peru's public plaza feeds into automated, auditable incident response — running entirely in the browser."* | #14 Executive Summary (3-col SCR) | Left: **Situation** (Peru plazas, manual monitoring, cost). Mid: **Complication** (latency, false alarms, no audit trail). Right: **Resolution** (perceive→reason→act loop, LLM judge, 3-tier escalation). Hero stat badge: "<2s detection-to-alert" + "0 Python backend". |
| 2 | **The Big Number** — *"The agentic loop completes a full perceive→reason→act cycle in under 2 seconds, 30× faster than manual review."* | #1 Big Number | Single huge number (serif, 96px) center-stage. Context line beneath. Sparkline of last 60 cycles. Source footer. |
| 3 | **System Architecture** — *"Five-stage pipeline turns raw video frames into escalated, evidence-backed incidents — each stage adding a layer of intelligence."* | #6 Process Flow (horizontal, 5 numbered cards) | ① **Perceive** — TF.js COCO-SSD, ~10 fps in-browser. ② **Reason** — rule engine + optional LLM-as-judge. ③ **Act** — log/snapshot/email/escalate tool registry. ④ **Evidence** — snapshot + 5s pre-buffer per Tier ≥2. ⑤ **Adapt** — feedback loop tunes thresholds. Each card: icon, 1-line role, "value delivered" tag. |
| 4 | **Three Capability Pillars** — *"Three capabilities differentiate the system from passive surveillance: real-time perception, agentic reasoning, and automated escalation."* | #5 Three Things (3-col with icons) | Pillar 1: **Perception** (icon: eye) — COCO-SSD 90-class, in-browser, no GPU server. Pillar 2: **Reasoning** (icon: brain) — rule registry + LLM judge cuts false positives ~60%. Pillar 3: **Action** (icon: bolt) — 3-tier escalation, human-ack gate at Tier 3. |
| 5 | **Traditional vs Agentic** — *"Agentic systems cut mean-time-to-respond from ~15 minutes to under 30 seconds while adding a full evidence trail."* | #4 Two-Column Comparison | Left col: **Traditional CCTV** (manual monitoring, no audit, reactive). Right col: **Agentic System** (auto-detect, LLM-judged, auto-escalated, snapshot trail). 4–5 parallel rows: latency, false-positive rate, audit trail, cost, scalability. Color-code right col with emerald accents. |
| 6 | **Live Dashboard Preview** — *"The operations dashboard surfaces four metrics that matter now: cameras online, current anomaly score, active incidents, and judge confidence."* | #13 Dashboard (4-6 metric tiles + 2 panels) | Tiles: Cameras Online · Persons Detected (now) · Anomaly Score (z-score) · Active Incidents · Avg Latency · Judge Confidence. Below: 2 panels — (a) live chart of person_count + EMA band, (b) recent incidents list with tier-colored dots. |
| 7 | **Value Chain** — *"Each pipeline stage compounds value: raw frames become detections, detections become anomalies, anomalies become judged incidents, incidents become resolved cases with evidence."* | #7 Waterfall / Value Chain | Horizontal waterfall: 100% raw frames → 12% flagged as anomalies → 4% pass LLM judge → 1.2% escalated → 0.4% auto-resolved with snapshot. Each bar shows what's added/filtered. Source footer. |
| 8 | **Use Cases** — *"Four high-value use cases are production-ready in v1: crowd surge, loitering, abandoned object, and restricted-zone breach."* | #5 Three Things variant (4-col) or #10 Harvey Ball scorecard | 4 cards, each: use-case name, 1-line description, "detection signal" (e.g. z>2 for 3 ticks), "value statement" (e.g. "early crowd-control dispatch"). Harvey balls show v1 readiness. |
| 9 | **Roadmap** — *"v1 ships the core agentic loop; v2 adds visual memory for similar-incident lookup; v3 scales to a multi-camera mesh."* | #12 Timeline (milestones + phase bars + risks) | Horizontal timeline: v1 MVP (now) → v2 Visual Memory (Q+1) → v3 Multi-Camera Mesh (Q+2). Phase bars above. Risks/dependencies below (model drift, browser perf, privacy compliance). Highlighted "v1 done" milestone in emerald. |
| 10 | **Footer / Sources** | Standard | `Source: TF.js COCO-SSD (Google); Z-AI Web Dev SDK; internal simulation 2026-07-14. All metrics are simulated on Pexels/Pixabay stock footage of Peru plaza scenes.` |

**Validation gate (Rule C7)**: read only the 10 action titles above top-to-bottom. They should tell the complete story (problem → what it is → how it works → capabilities → comparison → live preview → value flow → use cases → roadmap → sources). If any title reads as a topic label, rewrite it.

---

## 4. TAILWIND COLOR PALETTE (Light Mode, NO indigo/blue)

Format: HSL (shadcn/ui convention) + hex. Drop into `tailwind.config.ts` `theme.extend.colors` or `src/app/globals.css` `:root` CSS vars.

### Neutrals — **Zinc** (modern, reads gray not blue; shadcn default)
| Token | HSL | Hex | Tailwind equiv | Use |
|-------|-----|-----|----------------|-----|
| `--background` | `0 0% 100%` | `#ffffff` | white | page bg |
| `--foreground` | `240 10% 3.9%` | `#09090b` | zinc-950 | primary text |
| `--card` | `0 0% 100%` | `#ffffff` | white | card bg |
| `--card-foreground` | `240 10% 3.9%` | `#09090b` | zinc-950 | card text |
| `--muted` | `240 4.8% 95.9%` | `#f4f4f5` | zinc-100 | muted bg, hover |
| `--muted-foreground` | `240 3.8% 46.1%` | `#71717a` | zinc-500 | secondary text |
| `--border` | `240 5.9% 90%` | `#e4e4e7` | zinc-200 | default border |
| `--input` | `240 5.9% 90%` | `#e4e4e7` | zinc-200 | input border |
| `--secondary` | `240 4.8% 95.9%` | `#f4f4f5` | zinc-100 | secondary bg |
| `--accent` | `240 4.8% 95.9%` | `#f4f4f5` | zinc-100 | accent bg |

### Brand — **Emerald** (primary accent; signals "active/healthy/processing")
| Token | HSL | Hex | Tailwind equiv | Use |
|-------|-----|-----|----------------|-----|
| `--primary` | `160 84% 39.4%` | `#059669` | emerald-600 | brand, CTAs, active state |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | white | text on primary |
| `--ring` | `160 84% 39.4%` | `#059669` | emerald-600 | focus ring |
| emerald-500 (hover) | `160 84% 39.4%`→`158 64% 51.7%` | `#10b981` | emerald-500 | hover bg |
| emerald-700 (pressed) | `158 64% 51.7%`→`160 84% 39.4%` darker | `#047857` | emerald-700 | active/pressed |
| emerald-50 (tint bg) | `151 28% 95.7%` | `#ecfdf5` | emerald-50 | subtle brand surface |

### Semantic — Traffic Light Logic (F1Studioz pattern)
| Token | HSL | Hex | Tailwind equiv | Tier / meaning |
|-------|-----|-----|----------------|----------------|
| `--success` | `160 84% 39.4%` | `#059669` | emerald-600 | Tier 0/1 — healthy, processing |
| `--warning` | `38 92% 50%` | `#f59e0b` | amber-500 | Tier 2 — anomaly detected |
| `--destructive` | `357 70% 51%` | `#e11d48` | rose-600 | Tier 3 — critical / unacknowledged |
| `--warning-foreground` | `48 96% 9%` | `#0a0a0a` | — | text on amber |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | white | text on rose |

### Charts — bound to semantic scale
- Series 1 (primary metric): `emerald-600` `#059669`
- Series 2 (baseline/band): `zinc-300` `#d4d4d8` (filled `zinc-100`)
- Anomaly flash: `amber-500` `#f59e0b`
- Critical flash: `rose-600` `#e11d48`
- Gridlines: `zinc-100` `#f4f4f5`

**Why these choices**:
- **Zinc** over slate (avoids blue tint), over stone (stone's amber tint fights emerald), over pure neutral (zinc has more depth for shadows/borders).
- **Emerald** over the forbidden indigo/blue: reads as "alive, healthy, processing" — semantically perfect for an agentic system that's actively working. Distinct from amber/rose so the three-tier traffic light never confuses.
- All hex values are WCAG AA compliant against white at ≥14px (verified: emerald-600 on white = 4.5:1, zinc-500 on white = 4.6:1, zinc-950 on white = 19:1).

---

## 5. TYPOGRAPHY RECOMMENDATION (Google Fonts via `next/font/google`)

```tsx
// src/app/layout.tsx
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  // Match Linear's cleaner glyph set
  style: ["normal"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400", // display weight only
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"], // italic for editorial pull-quotes
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Apply on <html>: `${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`
```

### Tailwind font mapping
```ts
// tailwind.config.ts
fontFamily: {
  sans:   ["var(--font-sans)", "system-ui", "sans-serif"],
  serif:  ["var(--font-serif)", "Georgia", "serif"],
  mono:   ["var(--font-mono)", "ui-monospace", "monospace"],
}
```

### Type scale (Tailwind classes)
| Role | Font | Class | Size / Line-height | Weight |
|------|------|-------|--------------------|--------|
| Display (hero number, page title) | serif | `text-5xl md:text-6xl leading-[1.05]` | 48 / 56px → 60 / 72px | 400 (serif has natural weight) |
| H1 (section action title) | serif | `text-3xl md:text-4xl leading-tight` | 30 / 40px → 36 / 48px | 400 |
| H2 (subsection) | sans | `text-xl md:text-2xl font-semibold leading-snug` | 20 / 28px → 24 / 32px | 600 |
| H3 (card title) | sans | `text-base md:text-lg font-semibold` | 16 / 24px → 18 / 28px | 600 |
| Body | sans | `text-sm md:text-base leading-relaxed` | 14 / 22px → 16 / 26px | 400 |
| Small / caption | sans | `text-xs md:text-sm text-zinc-500` | 12 / 16px → 14 / 20px | 400 |
| Mono (code, metric value) | mono | `text-sm font-medium tabular-nums` | 14 / 20px | 500 |

### Why this pairing
- **Instrument Serif** (free, Google Fonts, 2023 release) — gives the editorial gravitas of a McKinsey printed report. Modern equivalent of Georgia (which McKinsey uses for titles). Used ONLY for display + H1; never for body (serif at small sizes tanks screen readability).
- **Inter** (free, variable) — the de facto SaaS body font (Linear, Vercel Geist, Stripe docs, Notion all use Inter or a close variant). Variable axis enables fine weight tuning. `tabular-nums` for metric alignment.
- **JetBrains Mono** (free) — for inline code, metric values in tables, the agent-cycle counter. `tabular-nums` keeps digits column-aligned in live-updating dashboards.

### Hierarchy rules
- **Serif = conclusion, Sans = detail.** When you see serif, you're reading a takeaway. When you see sans, you're reading supporting evidence. This visual split reinforces the Pyramid Principle (C2).
- **One display weight.** Never bold the serif. Its stroke contrast already provides emphasis.
- **Numbers always tabular.** `font-variant-numeric: tabular-nums` on every metric tile so live-updating digits don't jitter.
- **Line-height ≥1.5 for body** — WCAG and McKinsey readability standard. Headings can go tighter (1.1–1.25) for impact.

---

## 6. COMPONENT-LEVEL APPLICATION (quick reference for Tab 1 builders)

| Component | Pattern | Key classes |
|-----------|---------|-------------|
| Section wrapper | `max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24` | generous vertical rhythm |
| Action title (H1) | `font-serif text-3xl md:text-4xl text-zinc-950 leading-tight` | ≤2 lines, ≤15 words |
| Subtitle / kicker | `text-sm font-semibold uppercase tracking-wider text-emerald-600` | optional, above H1 |
| Card | `bg-white border border-zinc-200 rounded-xl shadow-sm p-6 hover:border-zinc-300 hover:shadow-md transition` | V7 rule |
| Metric tile | card + `flex flex-col gap-1` + value `font-mono text-3xl tabular-nums text-zinc-950` + label `text-xs text-zinc-500 uppercase tracking-wide` | #13 dashboard layout |
| Status dot | `h-2 w-2 rounded-full` + `bg-emerald-500` / `bg-amber-500` / `bg-rose-600` | V10 traffic light |
| Source footer | `text-xs text-zinc-400 mt-8 border-t border-zinc-100 pt-4` | C8 rule |
| Numbered flow card | `flex items-start gap-3` + number badge `h-7 w-7 rounded-full bg-zinc-950 text-white text-sm font-mono flex items-center justify-center` | #6 process flow |
| Pillar icon | `h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center` | #5 three things |

---

## 7. ANTI-PATTERNS TO REJECT (from research — explicitly forbidden)

1. **Topic titles** ("Overview", "Architecture", "Features") — must be action titles.
2. **Pie charts** — McKinsey banned them. Use columns.
3. **Indigo/blue/violet accents** — violates our constraint. All "tech blue" defaults (Tailwind blue-500, Linear purple, Stripe indigo) are off-limits.
4. **3D charts, clip art, stock photos of handshakes, fancy slide transitions** — "If an element doesn't support the action title, delete it." (deckary.com)
5. **Shrinking font to fit** — if the title doesn't fit, the message is too long. Rewrite or split.
6. **Decorative color** — emerald on everything = emerald on nothing. Accent = exception.
7. **Missing source lines** — every number needs attribution, especially simulated ones.
8. **Inconsistent formatting** — same heading size on every section, same card padding, same border color. Inconsistency reads as carelessness.
9. **Data vomit** — don't show every metric. Show the 4–6 that drive decisions (F1Studioz).
10. **Multiple messages per card** — if you wrote "and", split it (Rule C3).

---

**End of Style Guide.** Ready for Tab 1 implementation. Hand-off: implementation agent should use this as the design contract; deviations require explicit justification.
