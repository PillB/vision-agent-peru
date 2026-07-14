'use client'

import { useState, useCallback } from 'react'
import {
  ArrowRight,
  Eye,
  Brain,
  Zap,
  RefreshCw,
  Clock,
  TrendingUp,
  Layers,
  Target,
  AlertTriangle,
  CheckCircle2,
  Quote as QuoteIcon,
  ArrowUpRight,
  Cpu,
  Sparkles,
  Download,
  FileText,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  STAGES,
  TIMELINE,
  COMPARISON,
  AUTONOMY_SPECTRUM,
  MATURITY_LADDER,
  QUOTES,
  MARKET_STATS,
  CAPABILITY_LEAPS,
  SOURCES,
} from '@/lib/stages'

interface Props {
  onTryPrototype: () => void
  onSeeOverview: () => void
}

const TOTAL_SLIDES = 10

export function Tab3StrategicBrief({ onTryPrototype, onSeeOverview }: Props) {
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPptx = useCallback(async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/export-pptx')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cusco-vision-agent-strategic-brief.pptx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PowerPoint downloaded', {
        description: 'Single-slide .pptx with native editable objects · 13.333" × 7.5"',
        duration: 5000,
      })
    } catch (err) {
      console.error('[download-pptx] error:', err)
      toast.error('Download failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setDownloading(false)
    }
  }, [])

  return (
    <main className="bg-white text-zinc-950">
      {/* ============================================================
          SLIDE 1 — HERO / EXECUTIVE SUMMARY
          "AI has crossed four thresholds in 70 years — and the fourth,
          agentic systems, is the one that finally acts on the world."
      ============================================================ */}
      <SlideSection slideNumber={1} kicker="Executive Summary">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-7">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-zinc-950">
              AI has crossed four thresholds in 70 years — and the fourth,{' '}
              <span className="italic text-emerald-700">agentic systems</span>, is the one that finally acts on the world.
            </h1>
            <p className="mt-6 text-base md:text-lg text-zinc-600 max-w-2xl leading-relaxed">
              Since the 1956 Dartmouth Workshop, artificial intelligence has progressed through four capability eras: rule-based programs, machine learning, generative AI, and now agentic systems. Each era automated a slice of work but stopped at the screen. The leap to agentic AI closes the loop — systems now perceive, reason, act, and self-correct against goals.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={onTryPrototype} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                See the live prototype
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={onSeeOverview} variant="outline">
                Read the architecture
              </Button>
              <Button
                onClick={handleDownloadPptx}
                disabled={downloading}
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    PowerPoint (.pptx)
                  </>
                )}
              </Button>
            </div>
            <p className="mt-3 text-xs text-zinc-400 flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Single-slide brief with native, fully-editable PowerPoint objects
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="grid grid-cols-3 gap-px bg-zinc-200 rounded-xl overflow-hidden border border-zinc-200">
              <ScrCard
                label="Situation"
                icon={<Clock className="h-4 w-4" />}
                tone="zinc"
                body="Four AI eras in 70 years. Each solved the previous era's ceiling but stopped short of action."
              />
              <ScrCard
                label="Complication"
                icon={<AlertTriangle className="h-4 w-4" />}
                tone="amber"
                body="Gartner: AI agents are the fastest-advancing tech on the 2025 Hype Cycle. 60% of orgs expect to deploy within 2 years."
              />
              <ScrCard
                label="Resolution"
                icon={<Zap className="h-4 w-4" />}
                tone="emerald"
                body="Cusco Vision Agent is built natively on the agentic pattern: perceive → reason → act → reflect, end to end."
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <BigStat value="<2s" label="Perceive → reason → act cycle" tone="emerald" />
              <BigStat value="4" label="AI capability eras, 70 years" tone="zinc" />
            </div>
          </div>
        </div>
        <SourceLine sources={['McKinsey "What is AI?" 2024', 'Gartner 2025 Hype Cycle', 'Stanford HAI AI Index 2025']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 2 — THE 70-YEAR TIMELINE
          "Each AI era solved the previous era's ceiling — rules lacked
          learning, learning lacked generation, generation lacked action."
      ============================================================ */}
      <SlideSection slideNumber={2} kicker="Timeline">
        <ActionTitle>
          Each AI era solved the previous era&rsquo;s ceiling — rules lacked learning, learning lacked generation, generation lacked action.
        </ActionTitle>
        <OrientingParagraph>
          The four eras are not strictly sequential — they are nested capabilities. Every Stage 4 agentic system contains Stage 3 generative models that were trained using Stage 2 deep learning on patterns originally identified by Stage 1 rules. Each era ADDED a capability without losing the previous one.
        </OrientingParagraph>

        {/* Horizontal timeline */}
        <div className="mt-12 relative">
          {/* Phase bars */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            {TIMELINE.map((phase) => {
              const stage = STAGES[phase.stage - 1]
              return (
                <div
                  key={phase.stage}
                  className="rounded-lg border border-zinc-200 bg-white p-4"
                  style={{ borderTopColor: stage.hex, borderTopWidth: 3 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-zinc-400">Stage {phase.stage}</span>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.hex }} />
                  </div>
                  <div className="text-sm font-semibold text-zinc-950">{phase.label}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">{phase.era}</div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-600"><span className="font-medium text-zinc-950">Solved:</span> {phase.solved}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-600"><span className="font-medium text-zinc-950">Lacked:</span> {phase.lacked}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Timeline axis with milestones */}
          <div className="relative h-16 mt-6">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-300" />
            {TIMELINE.flatMap((phase) =>
              phase.milestones.map((m, i) => {
                const stageIdx = phase.stage - 1
                const leftPct = ((stageIdx + (i + 1) * 0.5) / 4) * 100
                return (
                  <div
                    key={`${phase.stage}-${i}`}
                    className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <div
                      className="h-3 w-3 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: STAGES[stageIdx].hex }}
                    />
                    <div className="absolute top-5 text-center whitespace-nowrap">
                      <div className="font-mono text-[10px] text-zinc-950 font-semibold">{m.year}</div>
                      <div className="text-[10px] text-zinc-500 max-w-[140px] leading-tight">{m.event}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-12 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>1956 — Dartmouth Workshop</span>
            <span>2025 — Agentic AI at Peak of Expectations</span>
          </div>
        </div>
        <SourceLine sources={['McKinsey "What is AI?" 2024', 'IBM "Evolution of AI Agents" 2025']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 3 — THE 4 STAGES DEFINED (reference card)
          "Four stages, nested not sequential — every agentic system
          still contains rules, learning, and generative models inside it."
      ============================================================ */}
      <SlideSection slideNumber={3} kicker="Definitions">
        <ActionTitle>
          Four stages, nested not sequential — every agentic system still contains rules, learning, and generative models inside it.
        </ActionTitle>
        <OrientingParagraph>
          This is the dense reference card for the rest of the brief. Each card defines what the era IS, what it CAN do, what it CAN&rsquo;T do, and the economic value it created. The nesting insight (bottom-right) is critical: agentic AI does not replace generative AI — it builds on top of it.
        </OrientingParagraph>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => (
            <StageCard key={stage.n} stage={stage} />
          ))}
        </div>

        {/* Nested pyramid inset */}
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-zinc-950">The nesting insight — capabilities stack, they don&rsquo;t replace</h3>
          </div>
          <div className="flex flex-col items-center gap-1">
            {STAGES.slice().reverse().map((stage, i) => (
              <div
                key={stage.n}
                className="flex items-center justify-center text-white text-xs font-semibold py-2 rounded transition"
                style={{
                  backgroundColor: stage.hex,
                  width: `${100 - i * 18}%`,
                  minWidth: '180px',
                }}
              >
                Stage {stage.n}: {stage.name} — adds {stage.n === 4 ? 'autonomy + tool use' : stage.n === 3 ? 'generation' : stage.n === 2 ? 'learning' : 'rules'}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-600 leading-relaxed">
            An effective Stage 4 system (agentic) almost always contains Stage 3 agents that use Stage 2 generative models that were trained on patterns originally identified by Stage 1 systems. Removing any layer breaks the whole stack.
          </p>
        </div>
        <SourceLine sources={['Synthesis of McKinsey, VastData, Bain, Aditya Sharma (LinkedIn) 2024–2025']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 4 — THE LEAP: PERCEIVE → REASON → ACT → REFLECT LOOP
          "Agentic AI adds the loop the previous eras lacked: perceive,
          reason, act, reflect — and repeat until the goal is met."
      ============================================================ */}
      <SlideSection slideNumber={4} kicker="The Leap">
        <ActionTitle>
          Agentic AI adds the loop the previous eras lacked: perceive, reason, act, reflect — and repeat until the goal is met.
        </ActionTitle>
        <OrientingParagraph>
          Generative AI does input → output. Agentic AI does input → plan → act → verify → revise. The loop is the whole point. It is what lets an agent pursue a goal over time, recover from failure, and adapt to changing conditions — capabilities no prior era had.
        </OrientingParagraph>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Loop diagram */}
          <LoopDiagram />

          {/* Capability leaps */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
              Four capability leaps
            </div>
            {CAPABILITY_LEAPS.map((leap, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-zinc-400">0{i + 1}</span>
                  <span className="text-xs font-medium text-zinc-500 line-through">{leap.from}</span>
                  <ArrowRight className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">{leap.to}</span>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{leap.description}</p>
              </div>
            ))}
          </div>
        </div>
        <SourceLine sources={['FedResources "Agentic AI: The Next Leap" 2025', 'MIT Sloan "Agentic AI, Explained" 2025', 'arXiv survey 2504.18875 (2025)']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 5 — GENERATIVE vs AGENTIC SIDE-BY-SIDE
          "Generative AI produces output; agentic AI pursues goals — the
          difference is tool use, multi-step planning, and self-correction."
      ============================================================ */}
      <SlideSection slideNumber={5} kicker="Comparison">
        <ActionTitle>
          Generative AI produces output; agentic AI pursues goals — the difference is tool use, multi-step planning, and self-correction.
        </ActionTitle>
        <OrientingParagraph>
          For skeptical executives who think &ldquo;agentic&rdquo; is just a rebrand of generative AI. The matrix below makes the distinction concrete across six capability dimensions. The right column is not a bigger version of the left — it is a different category of system.
        </OrientingParagraph>

        <div className="mt-10 overflow-hidden rounded-xl border border-zinc-200">
          <div className="grid grid-cols-3 bg-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-600">
            <div className="p-4">Capability</div>
            <div className="p-4 border-l border-zinc-200">Generative AI (Stage 3)</div>
            <div className="p-4 border-l border-zinc-200 bg-emerald-50/60 text-emerald-800">Agentic AI (Stage 4)</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={row.capability} className={`grid grid-cols-3 ${i !== COMPARISON.length - 1 ? 'border-b border-zinc-200' : ''}`}>
              <div className="p-4 text-sm font-medium text-zinc-950 bg-zinc-50/40">{row.capability}</div>
              <div className="p-4 border-l border-zinc-200 text-sm text-zinc-600">{row.generative}</div>
              <div className="p-4 border-l border-zinc-200 text-sm text-zinc-950 bg-emerald-50/30 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{row.agentic}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border-l-4 border-amber-500 bg-amber-50/50 p-4">
          <p className="text-sm text-zinc-700 leading-relaxed">
            <span className="font-semibold text-zinc-950">Bottom line:</span> Generative AI gave us copilots that assist human work by generating output. Agentic AI can reason, collaborate, and coordinate multistep work across systems. The shift is from <em>assistance</em> to <em>execution</em>.
          </p>
        </div>
        <SourceLine sources={['Bain "What Is Agentic AI" 2025']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 6 — THE AUTONOMY SPECTRUM
          "True agency begins only at Level 5 — when the system can loop,
          retry, and self-correct, not just route between fixed steps."
      ============================================================ */}
      <SlideSection slideNumber={6} kicker="Autonomy Spectrum">
        <ActionTitle>
          True agency begins only at Level 5 — when the system can loop, retry, and self-correct, not just route between fixed steps.
        </ActionTitle>
        <OrientingParagraph>
          Most systems marketed as &ldquo;AI agents&rdquo; are actually Level 3 or 4 — fixed chains or routers that branch between human-defined steps. The autonomy threshold is crossed only when the LLM itself controls the loop: deciding to retry, to revise, to call a different tool. Below the line, traditional governance still works. Above it, you need new security, observability, and approval gates.
        </OrientingParagraph>

        <div className="mt-12">
          {/* Spectrum bar */}
          <div className="relative">
            <div className="grid grid-cols-6 gap-1">
              {AUTONOMY_SPECTRUM.map((lvl) => {
                const stage = lvl.autonomous ? STAGES[3] : lvl.level <= 2 ? STAGES[0] : lvl.level <= 4 ? STAGES[1] : STAGES[2]
                return (
                  <div
                    key={lvl.level}
                    className="rounded-md p-3 text-white text-center"
                    style={{ backgroundColor: stage.hex }}
                  >
                    <div className="font-mono text-xs opacity-80">L{lvl.level}</div>
                    <div className="text-sm font-semibold mt-1">{lvl.name}</div>
                    <div className="text-[10px] opacity-90 mt-1 leading-tight">{lvl.capability}</div>
                  </div>
                )
              })}
            </div>

            {/* Threshold line */}
            <div className="absolute top-0 bottom-0 flex items-center" style={{ left: '66.6%' }}>
              <div className="h-32 w-px border-l-2 border-dashed border-rose-500" />
              <div className="absolute -top-2 -translate-x-1/2 left-0.5 whitespace-nowrap">
                <div className="bg-rose-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide">
                  Autonomy threshold
                </div>
              </div>
              <div className="absolute -bottom-6 -translate-x-1/2 left-0.5 whitespace-nowrap text-[10px] text-rose-600 font-medium">
                Governance model must change
              </div>
            </div>
          </div>

          {/* Labels below */}
          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Levels 1 – 4 · Human-constrained</div>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Code, LLM calls, chains, and routers. Every step is human-defined. Traditional governance (RBAC, audit logs, code review) is sufficient. Most &ldquo;AI agents&rdquo; sold today live here.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">Levels 5 – 6 · LLM-executed</div>
              <p className="text-sm text-zinc-700 leading-relaxed">
                State machines and autonomous goal-seekers. The LLM decides when to loop, retry, or switch strategy. Requires new security (runtime policy enforcement), observability (action replay), and approval gates (human-in-the-loop at high tiers).
              </p>
            </div>
          </div>

          {/* Cusco pin */}
          <div className="mt-6 flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="font-semibold text-zinc-950">Cusco Vision Agent operates at L5</span>
            <span className="text-zinc-500">— it loops the perceive-reason-act cycle autonomously, with a circuit breaker for safety.</span>
          </div>
        </div>
        <SourceLine sources={['Unstructured.io "Defining the Autonomous Enterprise" 2025']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 7 — MARKET TIMING: HYPE CYCLE 2025
          "AI agents sit at the Peak of Inflated Expectations — the most
          aggressive adoption curve of any emerging technology measured."
      ============================================================ */}
      <SlideSection slideNumber={7} kicker="Market Timing">
        <ActionTitle>
          AI agents sit at the Peak of Inflated Expectations — the most aggressive adoption curve of any emerging technology measured.
        </ActionTitle>
        <OrientingParagraph>
          The Gartner Hype Cycle tracks technology adoption through five phases. In the 2025 cycle, AI agents and AI-ready data are the two fastest-advancing technologies measured. The 2026 CIO Survey adds the adoption curve: 17% deployed today, 60% expect to deploy within two years. The window to learn the pattern is now — before your peers do.
        </OrientingParagraph>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Hype cycle SVG */}
          <div className="lg:col-span-7">
            <HypeCycleDiagram />
          </div>

          {/* Stat block */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
              The adoption curve
            </div>
            {MARKET_STATS.map((stat, i) => (
              <StatCallout key={i} value={stat.value} caption={stat.caption} source={stat.source} />
            ))}
          </div>
        </div>
        <SourceLine sources={['Gartner 2025 Hype Cycle press release', 'Gartner 2026 CIO Survey', 'Stanford HAI AI Index 2025', 'Deloitte State of AI 2026']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 8 — ENTERPRISE REALITY: WHERE MOST ORGS ARE STUCK
          "85% of employees are stuck at stages 2-3 of AI adoption —
          only 10% have reached the agentic stage."
      ============================================================ */}
      <SlideSection slideNumber={8} kicker="Enterprise Reality">
        <ActionTitle>
          85% of employees are stuck at stages 2–3 of AI adoption — only 10% have reached the agentic stage.
        </ActionTitle>
        <OrientingParagraph>
          BCG&rsquo;s 2025 adoption study maps employee AI usage across five stages, from information assistance to fully autonomous orchestration. The damning finding: most organizations have purchased AI tools but haven&rsquo;t redesigned work around them. Deloitte confirms: 71% of enterprises use AI, but only 25% have moved 40%+ of pilots to production. The gap between deployment and value is a process-redesign problem, not a technology problem.
        </OrientingParagraph>

        <div className="mt-12">
          {/* Maturity ladder */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            {MATURITY_LADDER.map((step) => {
              const heightClass = step.step === 1 ? 'h-32' : step.step === 2 ? 'h-40' : step.step === 3 ? 'h-48' : step.step === 4 ? 'h-56' : 'h-64'
              const tone = step.step <= 2 ? 'bg-zinc-400' : step.step === 3 ? 'bg-amber-500' : step.step === 4 ? 'bg-emerald-500' : 'bg-emerald-600'
              const isYouHere = step.step === 3
              return (
                <div key={step.step} className="flex flex-col">
                  {isYouHere && (
                    <div className="text-center mb-2">
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-mono uppercase tracking-wide">
                        ← You are here
                      </Badge>
                    </div>
                  )}
                  <div className={`${heightClass} ${tone} rounded-t-lg p-3 text-white flex flex-col justify-end`}>
                    <div className="font-mono text-xs opacity-80">Stage {step.step}</div>
                    <div className="text-sm font-semibold mt-1 leading-tight">{step.name}</div>
                    <div className="text-[10px] opacity-90 mt-1 leading-tight">{step.definition}</div>
                    <div className="text-[10px] mt-2 font-mono opacity-80">{step.reached}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 85% bracket */}
          <div className="mt-4 relative">
            <div className="h-6 bg-amber-100 rounded flex items-center justify-center text-[10px] font-mono text-amber-800 font-semibold uppercase tracking-wide" style={{ width: '60%', marginLeft: '20%' }}>
              85% of employees stuck here — purchased tools, no process redesign
            </div>
          </div>

          {/* Side stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="font-mono text-2xl font-medium text-zinc-950 tabular-nums">71%</div>
              <div className="text-xs text-zinc-500 mt-1">Enterprises use AI</div>
              <div className="text-[10px] text-zinc-400 mt-1">Deloitte 2026</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="font-mono text-2xl font-medium text-zinc-950 tabular-nums">25%</div>
              <div className="text-xs text-zinc-500 mt-1">Moved 40%+ of pilots to production</div>
              <div className="text-[10px] text-zinc-400 mt-1">Deloitte 2026</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="font-mono text-2xl font-medium text-amber-700 tabular-nums">21%</div>
              <div className="text-xs text-zinc-500 mt-1">Have mature agent governance</div>
              <div className="text-[10px] text-zinc-400 mt-1">Deloitte 2026</div>
            </div>
          </div>
        </div>
        <SourceLine sources={['BCG "The AI Adoption Puzzle" 2025', 'Deloitte "State of AI in the Enterprise" 2026']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 9 — CUSCO VISION AGENT MAPPING
          "Cusco Vision Agent is built natively on Stage 4 — every plaza
          camera is a perceive-reason-act loop, not just a detector."
      ============================================================ */}
      <SlideSection slideNumber={9} kicker="Project Mapping">
        <ActionTitle>
          Cusco Vision Agent is built natively on Stage 4 — every plaza camera is a perceive-reason-act loop, not just a detector.
        </ActionTitle>
        <OrientingParagraph>
          Most civic-camera systems are Stage 2: they count people and trigger a static threshold alert. Cusco Vision Agent closes the loop. The diagram below maps the canonical agentic loop onto the actual prototype components, so you can see exactly which code does which cognitive function.
        </OrientingParagraph>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <LoopDiagram
            annotations={[
              { node: 'Perceive', label: 'TF.js COCO-SSD', detail: '90-class object detection, in-browser, ~1 Hz' },
              { node: 'Reason', label: 'Rule engine + LLM-as-judge', detail: 'z-score + sustain counter → tier 0–3 decision' },
              { node: 'Act', label: 'Tool registry', detail: 'log, snapshot, email, escalate, generate report' },
              { node: 'Reflect', label: 'LLM verdict feedback', detail: 'real/false_positive → tunes next-tick sensitivity' },
            ]}
          />

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
              What this means in practice
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-zinc-950">Analytics layer (Stage 2)</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                TF.js COCO-SSD detects persons. A 2-minute sliding-window z-score + EMA computes the anomaly score. Pure perception + statistics — no decisions.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-zinc-950">Agentic layer (Stage 4)</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Rule engine decides tier. LLM-as-judge filters false positives. Tool registry executes actions. Circuit breaker (max 5 escalations/hour) prevents runaway. The loop runs at 1 Hz, autonomously.
              </p>
            </div>
            <div className="rounded-lg border-l-4 border-emerald-600 bg-emerald-50/40 p-4">
              <p className="text-sm text-zinc-700 leading-relaxed">
                <span className="font-semibold text-zinc-950">The proof:</span> When a crowd surge is detected, the system doesn&rsquo;t just beep — it captures a snapshot, sends an email, invokes the LLM judge, and auto-generates a corporate incident report. End-to-end, &lt;2 seconds.
              </p>
            </div>
            <Button onClick={onTryPrototype} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Open the live prototype
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
        <SourceLine sources={['Project architecture (worklog 0-b, 0-c)', 'MIT Sloan "Agentic AI, Explained" 2025']} />
      </SlideSection>

      {/* ============================================================
          SLIDE 10 — STRATEGIC IMPERATIVE + SOURCES
          "The window to learn the agentic pattern is now — before 60% of
          your peers deploy it in the next 24 months."
      ============================================================ */}
      <SlideSection slideNumber={10} kicker="Strategic Imperative">
        <ActionTitle>
          The window to learn the agentic pattern is now — before 60% of your peers deploy it in the next 24 months.
        </ActionTitle>
        <OrientingParagraph>
          Agentic AI is not a future technology. It is a present-tense capability that most organizations will adopt within 24 months. The competitive question is not whether to deploy, but whether your governance, observability, and process redesign will be ready when you do.
        </OrientingParagraph>

        {/* Pull quote */}
        <div className="mt-10 rounded-xl border-l-4 border-emerald-600 bg-zinc-50 p-6 md:p-8">
          <QuoteIcon className="h-6 w-6 text-emerald-600 mb-3" />
          <p className="font-serif text-2xl md:text-3xl italic text-zinc-950 leading-snug">
            Agentic AI shifts human value beyond old-school productivity. AI can do that work instantly. Roles need to evolve.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            — World Economic Forum, <em>Rebuild the Enterprise for the Age of Agentic AI</em> (2025)
          </p>
        </div>

        {/* Three next-actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <NextActionCard
            number={1}
            title="Pilot one perceive-reason-act loop"
            body="Pick a real sensor or data stream (camera, log, queue). Build the full loop — not just detection. Measure decision-to-action latency."
          />
          <NextActionCard
            number={2}
            title="Stand up governance before scaling"
            body="Circuit breakers, audit trails, human-ack gates, runtime policy enforcement. Add these BEFORE the agent runs in production, not after."
          />
          <NextActionCard
            number={3}
            title="Treat the agent as a teammate"
            body="Redesign the human role around supervision, not execution. The Deloitte gap (71% use, 25% scale) is a process-redesign problem."
          />
        </div>

        {/* Sources */}
        <div className="mt-12 pt-8 border-t border-zinc-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">
            Sources (12 primary, all fetched & verified)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {SOURCES.map((src, i) => (
              <div key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                <span className="font-mono text-zinc-400 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="font-semibold text-zinc-950">{src.tag}</span> — {src.title} ({src.year})
                </span>
              </div>
            ))}
          </div>
        </div>
      </SlideSection>

      {/* Closing CTA */}
      <section className="bg-emerald-700 text-white">
        <div className="mx-auto max-w-6xl px-6 md:px-12 py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl leading-tight max-w-2xl">
              See the agentic loop running live on Peru&rsquo;s plazas.
            </h2>
            <p className="mt-2 text-sm text-emerald-100 max-w-2xl">
              The prototype runs the full perceive-reason-act-reflect loop. Switch to the Live Prototype tab to trigger a real escalation.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onTryPrototype} size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
              <Zap className="mr-2 h-4 w-4" />
              Live prototype
            </Button>
            <Button
              onClick={handleDownloadPptx}
              disabled={downloading}
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-emerald-800 hover:text-white bg-transparent"
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {downloading ? 'Generating...' : 'Download .pptx'}
            </Button>
            <Button onClick={onSeeOverview} size="lg" variant="outline" className="border-white text-white hover:bg-emerald-800 hover:text-white bg-transparent">
              Architecture
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

/* ============================================================
   Reusable sub-components
   ============================================================ */

function SlideSection({
  slideNumber,
  kicker,
  children,
}: {
  slideNumber: number
  kicker: string
  children: React.ReactNode
}) {
  return (
    <section className="relative border-b border-zinc-200 min-h-[88vh] flex flex-col justify-center">
      {/* Slide number */}
      <div className="absolute top-6 right-6 md:right-12 font-mono text-xs text-zinc-400">
        {String(slideNumber).padStart(2, '0')} / {TOTAL_SLIDES}
      </div>
      <div className="mx-auto max-w-6xl w-full px-6 md:px-12 py-16 md:py-24">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-3">
          {kicker}
        </div>
        {children}
      </div>
    </section>
  )
}

function ActionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-tight text-zinc-950 max-w-4xl">
      {children}
    </h2>
  )
}

function OrientingParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 text-base md:text-lg text-zinc-600 max-w-3xl leading-relaxed">
      {children}
    </p>
  )
}

function SourceLine({ sources }: { sources: string[] }) {
  return (
    <div className="mt-12 pt-4 border-t border-zinc-100 text-xs text-zinc-400 font-mono">
      Source: {sources.join(' · ')}
    </div>
  )
}

function ScrCard({
  label,
  icon,
  body,
  tone,
}: {
  label: string
  icon: React.ReactNode
  body: string
  tone: 'zinc' | 'amber' | 'emerald'
}) {
  const toneClasses = {
    zinc: 'bg-white text-zinc-950',
    amber: 'bg-amber-50 text-zinc-950',
    emerald: 'bg-emerald-50 text-zinc-950',
  }[tone]
  const labelColor = {
    zinc: 'text-zinc-500',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
  }[tone]
  return (
    <div className={`p-4 ${toneClasses}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${labelColor}`}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-700">{body}</p>
    </div>
  )
}

function BigStat({ value, label, tone }: { value: string; label: string; tone: 'zinc' | 'emerald' }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className={`font-serif text-3xl md:text-4xl tabular-nums ${tone === 'emerald' ? 'text-emerald-700' : 'text-zinc-950'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function StageCard({ stage }: { stage: typeof STAGES[number] }) {
  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col"
      style={{ borderTopColor: stage.hex, borderTopWidth: 3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-zinc-400">Stage {stage.n}</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.hex }} />
      </div>
      <h3 className="text-base font-semibold text-zinc-950 leading-tight">{stage.name}</h3>
      <div className="text-xs text-zinc-500 font-mono mt-0.5">{stage.era}</div>
      <div className="text-[10px] text-zinc-400 mt-0.5">{stage.also}</div>
      <p className="mt-3 text-xs text-zinc-700 leading-relaxed">{stage.def}</p>

      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">Can do</div>
        <ul className="space-y-0.5">
          {stage.can.map((c, i) => (
            <li key={i} className="text-[11px] text-zinc-600 flex items-start gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1">Can&rsquo;t do</div>
        <ul className="space-y-0.5">
          {stage.cant.map((c, i) => (
            <li key={i} className="text-[11px] text-zinc-600 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-100">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">Value created</div>
        <p className="text-[11px] text-zinc-700 leading-relaxed">{stage.value}</p>
      </div>
    </div>
  )
}

function LoopDiagram({
  annotations,
}: {
  annotations?: { node: string; label: string; detail: string }[]
}) {
  const nodes = [
    { name: 'Perceive', icon: <Eye className="h-5 w-5" />, angle: 0 },
    { name: 'Reason', icon: <Brain className="h-5 w-5" />, angle: 90 },
    { name: 'Act', icon: <Zap className="h-5 w-5" />, angle: 180 },
    { name: 'Reflect', icon: <RefreshCw className="h-5 w-5" />, angle: 270 },
  ]
  const size = 320
  const center = size / 2
  const radius = 110

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm">
        {/* Loop arrows (circle) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#059669"
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.4}
        />
        {/* Center label */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          className="font-serif"
          fontSize={13}
          fill="#27272a"
        >
          Autonomous
        </text>
        <text
          x={center}
          y={center + 8}
          textAnchor="middle"
          className="font-serif"
          fontSize={13}
          fill="#27272a"
        >
          Reasoning Loop
        </text>
        <text
          x={center}
          y={center + 26}
          textAnchor="middle"
          fontSize={9}
          fill="#a1a1aa"
          fontFamily="ui-monospace, monospace"
        >
          repeats until goal met
        </text>

        {/* Nodes */}
        {nodes.map((node, i) => {
          const angleRad = (node.angle * Math.PI) / 180
          const x = center + radius * Math.cos(angleRad)
          const y = center + radius * Math.sin(angleRad)
          const annotation = annotations?.find((a) => a.node === node.name)
          const nodeColor = annotation ? '#059669' : '#52525b'
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={28} fill="white" stroke={nodeColor} strokeWidth={2} />
              <text x={x} y={y - 22} textAnchor="middle" fontSize={9} fill={nodeColor} fontWeight={600} fontFamily="ui-monospace, monospace">
                {String(i + 1).padStart(2, '0')}
              </text>
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#27272a" fontWeight={600}>
                {node.name}
              </text>
              {/* Direction arrows on the circle between nodes */}
              {i < 4 && (
                <text
                  x={center + radius * 0.7 * Math.cos((node.angle + 45) * Math.PI / 180)}
                  y={center + radius * 0.7 * Math.sin((node.angle + 45) * Math.PI / 180)}
                  textAnchor="middle"
                  fontSize={14}
                  fill="#059669"
                  opacity={0.6}
                >
                  →
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Annotations */}
      {annotations && (
        <div className="mt-4 w-full space-y-2">
          {annotations.map((a, i) => (
            <div key={i} className="rounded-md border border-zinc-200 bg-zinc-50/50 p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-700">{a.node}</span>
                <span className="text-xs font-mono text-zinc-950">{a.label}</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-0.5">{a.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HypeCycleDiagram() {
  // Gartner hype cycle path — approximate with a cubic bezier
  const w = 560
  const h = 240
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-950">Gartner Hype Cycle — 2025</h3>
        <Badge variant="outline" className="text-[10px] font-mono">5 phases</Badge>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* Grid */}
        <line x1={40} y1={h - 30} x2={w - 20} y2={h - 30} stroke="#e4e4e7" />
        {/* Hype cycle curve */}
        <path
          d={`M 40 ${h - 60}
              C 120 ${h - 200}, 180 ${h - 200}, 240 ${h - 110}
              C 280 ${h - 50}, 320 ${h - 70}, 360 ${h - 90}
              C 420 ${h - 110}, 480 ${h - 80}, ${w - 20} ${h - 50}`}
          fill="none"
          stroke="#52525b"
          strokeWidth={2}
        />
        {/* Phase labels */}
        {['Innovation\nTrigger', 'Peak of\nInflated Exp.', 'Trough of\nDisillusionment', 'Slope of\nEnlightenment', 'Plateau of\nProductivity'].map((label, i) => (
          <text
            key={i}
            x={50 + i * 120}
            y={h - 12}
            textAnchor="middle"
            fontSize={8}
            fill="#71717a"
            fontFamily="ui-monospace, monospace"
          >
            {label.split('\n')[0]}
          </text>
        ))}
        {/* Markers */}
        {[
          { x: 220, y: h - 200, label: 'AI Agents', sub: 'Peak — 2025', color: '#f59e0b' },
          { x: 300, y: h - 65, label: 'GenAI', sub: 'Trough — 2025', color: '#71717a' },
          { x: 410, y: h - 100, label: 'AI Engineering', sub: 'Slope', color: '#059669' },
          { x: 130, y: h - 130, label: 'Agentic Governance', sub: 'Trigger', color: '#a1a1aa' },
        ].map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r={5} fill={m.color} stroke="white" strokeWidth={2} />
            <text x={m.x} y={m.y - 12} textAnchor="middle" fontSize={10} fontWeight={600} fill="#27272a">
              {m.label}
            </text>
            <text x={m.x} y={m.y - 24} textAnchor="middle" fontSize={8} fill="#71717a" fontFamily="ui-monospace, monospace">
              {m.sub}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
        AI agents and AI-ready data are the two fastest-advancing technologies on the 2025 Gartner Hype Cycle. Generative AI has slid into the Trough of Disillusionment as organizations confront ROI reality ($1.9M avg spend per initiative, &lt;30% CEO satisfaction).
      </p>
    </div>
  )
}

function StatCallout({ value, caption, source }: { value: string; caption: string; source: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 flex items-baseline gap-4">
      <div className="font-mono text-3xl md:text-4xl font-medium tabular-nums text-emerald-700 flex-shrink-0">
        {value}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-700 leading-snug">{caption}</div>
        <div className="text-[10px] text-zinc-400 mt-1 font-mono">{source}</div>
      </div>
    </div>
  )
}

function NextActionCard({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-full bg-emerald-600 text-white text-sm font-mono flex items-center justify-center">
          {number}
        </div>
        <Target className="h-4 w-4 text-emerald-600" />
      </div>
      <h4 className="text-sm font-semibold text-zinc-950 mb-2 leading-tight">{title}</h4>
      <p className="text-xs text-zinc-600 leading-relaxed">{body}</p>
    </div>
  )
}
