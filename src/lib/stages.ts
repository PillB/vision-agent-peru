/**
 * Strategic Brief data — the 4-stage AI evolution narrative.
 *
 * Single source of truth for Tab 3 content. Synthesized from 12 think-tank
 * sources (McKinsey, BCG, Bain, Gartner, Deloitte, WEF, Stanford HAI,
 * MIT Sloan, Sequoia, VastData, Cisco, Unstructured.io, IBM, arXiv).
 *
 * See /home/z/my-project/download/research/task3a/STRATEGIC_BRIEF_RESEARCH.md
 * for the full research corpus and source citations.
 */

export interface Stage {
  n: number
  name: string
  era: string
  also: string
  def: string
  can: string[]
  cant: string[]
  value: string
  /** Tailwind color token used consistently across all 10 slides. */
  color: 'zinc-400' | 'zinc-600' | 'amber-500' | 'emerald-600'
  /** Hex for SVG / inline use. */
  hex: string
}

export const STAGES: Stage[] = [
  {
    n: 1,
    name: 'Static Programs',
    era: '1956 – 1980s',
    also: 'Symbolic AI · RPA · Expert Systems',
    def: 'Humans encode rules; the system executes deterministic logic. Every decision step is fully auditable because a human wrote each rule.',
    can: [
      'Audit every decision step (fully explainable)',
      'Execute deterministic logic at machine speed',
      'Never drift from specification',
    ],
    cant: [
      'Handle unstructured input (images, free text)',
      'Learn from data — every edge case needs a new rule',
      'Adapt when context shifts',
    ],
    value: 'Scalable automation of high-volume, well-bounded tasks. The assembly line of the digital age.',
    color: 'zinc-400',
    hex: '#a1a1aa',
  },
  {
    n: 2,
    name: 'Machine Learning / Deep Learning',
    era: '1986 – 2017',
    also: 'Neural Networks · Supervised Learning',
    def: 'Models learn patterns directly from data. No human writes the rules — the model discovers them by minimizing error on a training set.',
    can: [
      'Perceive — classify images, transcribe speech, rank results',
      'Detect anomalies and score risk at scale',
      'Improve as more data arrives (up to retraining)',
    ],
    cant: [
      'Reason about goals or pursue multi-step objectives',
      'Retain context across sessions',
      'Explain why it decided (opaque feature space)',
    ],
    value: 'Perception at scale. Image recognition, fraud scoring, recommendation engines — the entire 2010s AI economy.',
    color: 'zinc-600',
    hex: '#52525b',
  },
  {
    n: 3,
    name: 'Cognitive / Generative AI',
    era: '2017 – 2023',
    also: 'Foundation Models · Copilots',
    def: 'Models trained on internet-scale data that synthesize new content — text, code, images, audio — by learning relationships across massive datasets.',
    can: [
      'Generate high-quality content across modalities',
      'Summarize, translate, and ideate',
      'Reason shallowly via chain-of-thought prompting',
    ],
    cant: [
      'Take action in the world — it waits for a prompt',
      'Pursue a goal over time or across sessions',
      'Self-correct when an action fails',
    ],
    value: '$33.9B private investment in 2024 (+18.7% YoY). 78% of organizations now use AI (up from 55%).',
    color: 'amber-500',
    hex: '#f59e0b',
  },
  {
    n: 4,
    name: 'Agentic AI',
    era: '2024 – present',
    also: 'AI Agents · Autonomous Systems · Software 3.0',
    def: 'Systems that perceive, reason, act, and self-correct in a loop until a goal is met. They plan multi-step workflows, use tools, and revise course as conditions change.',
    can: [
      'Plan multi-step workflows and revise plans',
      'Use tools and APIs autonomously (function calling)',
      'Reflect on errors and retry with a new strategy',
      'Coordinate with other agents (orchestration)',
    ],
    cant: [
      'Operate safely without governance and audit controls',
      'Replace human judgment at high-stakes decision tiers',
      'Avoid hallucination without grounding data',
    ],
    value: 'End-to-end process execution. "Sell work, not software" — targets the services profit pool, not the software profit pool.',
    color: 'emerald-600',
    hex: '#059669',
  },
]

export interface TimelinePhase {
  stage: number
  label: string
  era: string
  solved: string
  lacked: string
  milestones: { year: string; event: string }[]
}

export const TIMELINE: TimelinePhase[] = [
  {
    stage: 1,
    label: 'Symbolic AI',
    era: '1956 – 1980s',
    solved: 'Bounded, auditable automation',
    lacked: 'No learning; brittle under unstructured input',
    milestones: [
      { year: '1956', event: 'Dartmouth Workshop — "AI" coined' },
      { year: '1970s', event: 'Expert systems era' },
    ],
  },
  {
    stage: 2,
    label: 'Neural Networks',
    era: '1986 – 2017',
    solved: 'Perception — vision, speech, anomaly detection',
    lacked: 'No goal reasoning; context shallow; needed retraining',
    milestones: [
      { year: '1986', event: 'Hinton backpropagation' },
      { year: '2012', event: 'AlexNet wins ImageNet' },
    ],
  },
  {
    stage: 3,
    label: 'Generative AI',
    era: '2017 – 2023',
    solved: 'Content synthesis across modalities',
    lacked: 'No action; waits for prompt; no self-correction',
    milestones: [
      { year: '2017', event: 'Transformer architecture' },
      { year: '2022', event: 'ChatGPT — public inflection' },
    ],
  },
  {
    stage: 4,
    label: 'Agentic AI',
    era: '2024 – present',
    solved: 'Perceive → reason → act → reflect loop',
    lacked: 'Mature governance (still emerging)',
    milestones: [
      { year: '2024', event: 'OpenAI o1 — reasoning era' },
      { year: '2025', event: 'Gartner Peak of Expectations' },
    ],
  },
]

export interface ComparisonRow {
  capability: string
  generative: string
  agentic: string
}

export const COMPARISON: ComparisonRow[] = [
  {
    capability: 'Primary role',
    generative: 'Produces content on demand',
    agentic: 'Pursues a defined goal autonomously',
  },
  {
    capability: 'Typical interaction',
    generative: 'Prompt → response (single shot)',
    agentic: 'Goal → multi-step plan → execute → verify',
  },
  {
    capability: 'Workflow scope',
    generative: 'A single task inside a larger process',
    agentic: 'End-to-end process, across systems',
  },
  {
    capability: 'Tool use',
    generative: 'Reads context, writes text',
    agentic: 'Calls APIs, queries databases, runs code',
  },
  {
    capability: 'Self-correction',
    generative: 'None — output is final',
    agentic: 'Reflects on failure, retries with new strategy',
  },
  {
    capability: 'Enterprise value',
    generative: 'Copilots that assist human work',
    agentic: 'People become AI supervisors, not task executors',
  },
]

export interface AutonomyLevel {
  level: number
  name: string
  capability: string
  /** Whether the system crosses the autonomy threshold (L5+). */
  autonomous: boolean
}

export const AUTONOMY_SPECTRUM: AutonomyLevel[] = [
  { level: 1, name: 'Code', capability: 'Deterministic rules', autonomous: false },
  { level: 2, name: 'LLM Call', capability: 'Single output', autonomous: false },
  { level: 3, name: 'Chain', capability: 'Multi-step pipeline', autonomous: false },
  { level: 4, name: 'Router', capability: 'Branches between paths', autonomous: false },
  { level: 5, name: 'State Machine', capability: 'Loops, retries, self-corrects', autonomous: true },
  { level: 6, name: 'Autonomous', capability: 'Goal-seeking, open-ended', autonomous: true },
]

export interface MaturityStep {
  step: number
  name: string
  definition: string
  /** BCG stage label. */
  reached: string
}

export const MATURITY_LADDER: MaturityStep[] = [
  { step: 1, name: 'Information Assistance', definition: 'AI answers questions, summarizes docs', reached: '15% of employees' },
  { step: 2, name: 'Task Assistance', definition: 'AI drafts code, writes emails', reached: '50% of employees' },
  { step: 3, name: 'Delegation', definition: 'AI executes bounded tasks', reached: '35% of employees' },
  { step: 4, name: 'Semiautonomous Collaboration', definition: 'AI + human co-work on workflows', reached: '8% of employees' },
  { step: 5, name: 'Fully Autonomous Orchestration', definition: 'AI runs end-to-end processes', reached: '<2% of employees' },
]

export interface Quote {
  text: string
  attribution: string
  source: string
}

export const QUOTES: Quote[] = [
  {
    text: 'Agentic AI is a structural shift in enterprise tech, reshaping companies with agents that can reason, coordinate, and execute complex workflows.',
    attribution: 'Bain & Company',
    source: 'Building the Foundation for Agentic AI (2025)',
  },
  {
    text: 'The fundamental economic promise of AI agents is that they can dramatically reduce transaction costs — the time and effort involved in searching, comparing, and coordinating.',
    attribution: 'MIT Sloan',
    source: 'Agentic AI, Explained (2025)',
  },
  {
    text: 'It is not just the digital world — agents can actually take actions that change things happening in the physical world.',
    attribution: 'Sinan Aral, MIT Sloan',
    source: 'Agentic AI, Explained (2025)',
  },
  {
    text: 'Two years into the Generative AI revolution, research is progressing from "thinking fast" to "thinking slow" — reasoning at inference time.',
    attribution: 'Sequoia Capital',
    source: "Generative AI's Act o1 (2024)",
  },
  {
    text: 'Cloud companies sold software ($/seat). AI companies sell work ($/outcome). Cloud companies targeted the software profit pool. AI companies target the services profit pool.',
    attribution: 'Sequoia Capital',
    source: "Generative AI's Act o1 (2024)",
  },
  {
    text: 'Agentic AI shifts human value beyond old-school productivity. AI can do that work instantly. Roles need to evolve.',
    attribution: 'World Economic Forum',
    source: 'Rebuild the Enterprise for the Age of Agentic AI (2025)',
  },
  {
    text: 'Only 17% of organizations have deployed AI agents to date, yet more than 60% expect to do so within the next two years — the most aggressive adoption curve among all emerging technologies measured.',
    attribution: 'Gartner',
    source: '2026 CIO Survey',
  },
  {
    text: 'Agentic AI is not a detour in AI\'s history, but the next logical step in a long progression toward more adaptive and collaborative intelligence.',
    attribution: 'VastData',
    source: 'Evolution of AI: ML to Agentic (2025)',
  },
]

export interface MarketStat {
  value: string
  caption: string
  source: string
}

export const MARKET_STATS: MarketStat[] = [
  { value: '17%', caption: 'Organizations with AI agents deployed today', source: 'Gartner 2026 CIO Survey' },
  { value: '60%', caption: 'Expect to deploy within 2 years — most aggressive curve', source: 'Gartner 2026 CIO Survey' },
  { value: '$234B', caption: 'Enterprise app spend at risk from agentic AI', source: 'Gartner 2025 Hype Cycle' },
  { value: '$33.9B', caption: 'Private GenAI investment in 2024 (+18.7% YoY)', source: 'Stanford HAI AI Index 2025' },
  { value: '78%', caption: 'Organizations now use AI (up from 55%)', source: 'Stanford HAI AI Index 2025' },
  { value: '21%', caption: 'Have a mature model for agent governance', source: 'Deloitte State of AI 2026' },
]

export interface CapabilityLeap {
  from: string
  to: string
  description: string
}

export const CAPABILITY_LEAPS: CapabilityLeap[] = [
  {
    from: 'Reactive',
    to: 'Proactive',
    description: 'GenAI waits for a prompt; agents initiate action when conditions change.',
  },
  {
    from: 'Single-shot',
    to: 'Multi-step with feedback',
    description: 'GenAI does input → output; agents loop with environment feedback.',
  },
  {
    from: 'Answering',
    to: 'Executing',
    description: 'GenAI produces content; agents run multi-step workflows across systems.',
  },
  {
    from: 'Tool',
    to: 'Collaborator',
    description: 'GenAI is a feature; agentic AI coordinates other agents and self-corrects.',
  },
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
