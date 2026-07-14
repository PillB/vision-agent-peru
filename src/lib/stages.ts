/**
 * Strategic Brief structural data — text comes from translation files.
 *
 * This file holds ONLY the structural/non-translatable data: stage numbers,
 * colors, hex values. All user-facing text is in messages/en.json and
 * messages/es-PE.json under the "Stages", "Timeline", "Comparison", etc.
 * namespaces, resolved at render time via useTranslations().
 */

export interface StageStruct {
  n: number
  /** Translation key prefix: stage{n}Name, stage{n}Era, etc. */
  keyPrefix: string
  /** Tailwind color token. */
  color: 'zinc-400' | 'zinc-600' | 'amber-500' | 'emerald-600'
  /** Hex for SVG / inline use. */
  hex: string
}

export const STAGES: StageStruct[] = [
  { n: 1, keyPrefix: 'stage1', color: 'zinc-400', hex: '#a1a1aa' },
  { n: 2, keyPrefix: 'stage2', color: 'zinc-600', hex: '#52525b' },
  { n: 3, keyPrefix: 'stage3', color: 'amber-500', hex: '#f59e0b' },
  { n: 4, keyPrefix: 'stage4', color: 'emerald-600', hex: '#059669' },
]

export interface TimelinePhaseStruct {
  stage: number
  keyPrefix: string
  milestones: { year: string; milestoneKey: string }[]
}

export const TIMELINE: TimelinePhaseStruct[] = [
  {
    stage: 1,
    keyPrefix: 'phase1',
    milestones: [
      { year: '1956', milestoneKey: 'milestone1' },
      { year: '1970s', milestoneKey: 'milestone2' },
    ],
  },
  {
    stage: 2,
    keyPrefix: 'phase2',
    milestones: [
      { year: '1986', milestoneKey: 'milestone3' },
      { year: '2012', milestoneKey: 'milestone4' },
    ],
  },
  {
    stage: 3,
    keyPrefix: 'phase3',
    milestones: [
      { year: '2017', milestoneKey: 'milestone5' },
      { year: '2022', milestoneKey: 'milestone6' },
    ],
  },
  {
    stage: 4,
    keyPrefix: 'phase4',
    milestones: [
      { year: '2024', milestoneKey: 'milestone7' },
      { year: '2025', milestoneKey: 'milestone8' },
    ],
  },
]

export interface ComparisonRowStruct {
  rowPrefix: string
}

export const COMPARISON: ComparisonRowStruct[] = [
  { rowPrefix: 'row1' },
  { rowPrefix: 'row2' },
  { rowPrefix: 'row3' },
  { rowPrefix: 'row4' },
  { rowPrefix: 'row5' },
  { rowPrefix: 'row6' },
]

export interface AutonomyLevelStruct {
  level: number
  keyPrefix: string
  autonomous: boolean
}

export const AUTONOMY_SPECTRUM: AutonomyLevelStruct[] = [
  { level: 1, keyPrefix: 'l1', autonomous: false },
  { level: 2, keyPrefix: 'l2', autonomous: false },
  { level: 3, keyPrefix: 'l3', autonomous: false },
  { level: 4, keyPrefix: 'l4', autonomous: false },
  { level: 5, keyPrefix: 'l5', autonomous: true },
  { level: 6, keyPrefix: 'l6', autonomous: true },
]

export interface MaturityStepStruct {
  step: number
  keyPrefix: string
}

export const MATURITY_LADDER: MaturityStepStruct[] = [
  { step: 1, keyPrefix: 'step1' },
  { step: 2, keyPrefix: 'step2' },
  { step: 3, keyPrefix: 'step3' },
  { step: 4, keyPrefix: 'step4' },
  { step: 5, keyPrefix: 'step5' },
]

export interface CapabilityLeapStruct {
  index: number
  keyPrefix: string
}

export const CAPABILITY_LEAPS: CapabilityLeapStruct[] = [
  { index: 1, keyPrefix: 'leap1' },
  { index: 2, keyPrefix: 'leap2' },
  { index: 3, keyPrefix: 'leap3' },
  { index: 4, keyPrefix: 'leap4' },
]

export interface MarketStatStruct {
  keyPrefix: string
}

export const MARKET_STATS: MarketStatStruct[] = [
  { keyPrefix: 'stat1' },
  { keyPrefix: 'stat2' },
  { keyPrefix: 'stat3' },
  { keyPrefix: 'stat4' },
  { keyPrefix: 'stat5' },
  { keyPrefix: 'stat6' },
]

export interface UseCaseStruct {
  id: string
  keyPrefix: string
  tier: number
}

export const USE_CASES: UseCaseStruct[] = [
  { id: 'crowd_surge', keyPrefix: 'crowdSurge', tier: 2 },
  { id: 'sustained_density', keyPrefix: 'sustainedDensity', tier: 3 },
  { id: 'loitering', keyPrefix: 'loitering', tier: 2 },
  { id: 'restricted_zone', keyPrefix: 'restrictedZone', tier: 3 },
]

export const SOURCES = [
  { tag: 'McKinsey', title: 'What is AI?', year: '2024' },
  { tag: 'BCG', title: 'The AI Adoption Puzzle', year: '2025' },
  { tag: 'Bain', title: 'What Is Agentic AI', year: '2025' },
  { tag: 'Bain', title: 'Building the Foundation for Agentic AI', year: '2025' },
  { tag: 'Gartner', title: '2025 Hype Cycle for AI', year: '2025' },
  { tag: 'Gartner', title: '2026 CIO Survey', year: '2026' },
  { tag: 'Deloitte', title: 'State of AI in the Enterprise', year: '2026' },
  { tag: 'WEF', title: 'Age of Agentic AI', year: '2025' },
  { tag: 'Stanford HAI', title: 'AI Index Report', year: '2025' },
  { tag: 'MIT Sloan', title: 'Agentic AI, Explained', year: '2025' },
  { tag: 'Sequoia', title: "Generative AI's Act o1", year: '2024' },
  { tag: 'VastData', title: 'Evolution of AI: ML to Agentic', year: '2025' },
]
