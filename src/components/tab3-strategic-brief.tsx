'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { prefixPath } from '@/lib/path-utils'
import {
  ArrowRight,
  Eye,
  Brain,
  Zap,
  RefreshCw,
  Clock,
  Layers,
  Target,
  AlertTriangle,
  CheckCircle2,
  Quote as QuoteIcon,
  Cpu,
  Sparkles,
  Download,
  FileText,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  STAGES,
  TIMELINE,
  COMPARISON,
  AUTONOMY_SPECTRUM,
  MATURITY_LADDER,
  MARKET_STATS,
  CAPABILITY_LEAPS,
  USE_CASES,
  SOURCES,
} from '@/lib/stages'

interface Props {
  onTryPrototype: () => void
  onSeeOverview: () => void
}

const TOTAL_SLIDES = 10

export function Tab3StrategicBrief({ onTryPrototype, onSeeOverview }: Props) {
  const t = useTranslations()
  const [downloading, setDownloading] = useState(false)
  const [downloadingV2, setDownloadingV2] = useState(false)
  const [downloadingV3, setDownloadingV3] = useState(false)

  const handleDownloadPptx = useCallback(async (version: 'v1' | 'v2' | 'v3' = 'v1') => {
    const setter = version === 'v3' ? setDownloadingV3 : version === 'v2' ? setDownloadingV2 : setDownloading
    setter(true)
    try {
      const endpoint = version === 'v3' ? '/api/export-pptx-v3' : version === 'v2' ? '/api/export-pptx-v2' : '/api/export-pptx'
      const filename = version === 'v3' ? 'vision-agent-bcp-evolution.pptx' : version === 'v2' ? 'vision-agent-infographic.pptx' : 'vision-agent-strategic-brief.pptx'
      const res = await fetch(prefixPath(endpoint))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t('Tab3.download.toastTitle'), {
        description: version === 'v3'
          ? `${t('Tab3.download.toastDesc')} · BCP Z-flow`
          : version === 'v2'
          ? `${t('Tab3.download.toastDesc')} · Infografía`
          : t('Tab3.download.toastDesc'),
        duration: 5000,
      })
    } catch (err) {
      console.error('[download-pptx] error:', err)
      toast.error('Download failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setter(false)
    }
  }, [t])

  return (
    <main className="bg-white text-zinc-950">
      {/* ============================================================ SLIDE 1 — HERO ============================================================ */}
      <SlideSection slideNumber={1} kicker={t('Tab3.slide1.kicker')}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-7">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-zinc-950">
              {t('Tab3.slide1.title')}
            </h1>
            <p className="mt-6 text-base md:text-lg text-zinc-600 max-w-2xl leading-relaxed">
              {t('Tab3.slide1.body')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={onTryPrototype} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {t('Tab3.slide1.ctaPrototype')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={onSeeOverview} variant="outline">
                {t('Tab3.slide1.ctaArchitecture')}
              </Button>
              <Button onClick={() => handleDownloadPptx('v1')} disabled={downloading} variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                {downloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('Tab3.download.generating')}</> : <><Download className="mr-2 h-4 w-4" />{t('Tab3.download.button')}</>}
              </Button>
              <Button onClick={() => handleDownloadPptx('v2')} disabled={downloadingV2} variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
                {downloadingV2 ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('Tab3.download.generating')}</> : <><Sparkles className="mr-2 h-4 w-4" />{t('Tab3.download.button')} V2</>}
              </Button>
              <Button onClick={() => handleDownloadPptx('v3')} disabled={downloadingV3} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {downloadingV3 ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('Tab3.download.generating')}</> : <><Zap className="mr-2 h-4 w-4" />BCP Z-Flow V3</>}
              </Button>
            </div>
            <p className="mt-3 text-xs text-zinc-400 flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              {t('Tab3.download.hint')}
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="grid grid-cols-3 gap-px bg-zinc-200 rounded-xl overflow-hidden border border-zinc-200">
              <ScrCard label={t('Tab3.slide1.situation')} icon={<Clock className="h-4 w-4" />} tone="zinc" body={t('Tab3.slide1.situationBody')} />
              <ScrCard label={t('Tab3.slide1.complication')} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" body={t('Tab3.slide1.complicationBody')} />
              <ScrCard label={t('Tab3.slide1.resolution')} icon={<Zap className="h-4 w-4" />} tone="emerald" body={t('Tab3.slide1.resolutionBody')} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <BigStat value={t('Tab3.slide1.stat1Value')} label={t('Tab3.slide1.stat1Label')} tone="emerald" />
              <BigStat value={t('Tab3.slide1.stat2Value')} label={t('Tab3.slide1.stat2Label')} tone="zinc" />
            </div>
          </div>
        </div>
        <SourceLine sources={['McKinsey "What is AI?" 2024', 'Gartner 2025 Hype Cycle', 'Stanford HAI AI Index 2025']} />
      </SlideSection>

      {/* ============================================================ SLIDE 2 — TIMELINE ============================================================ */}
      <SlideSection slideNumber={2} kicker={t('Tab3.slide2.kicker')}>
        <ActionTitle>{t('Tab3.slide2.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide2.body')}</OrientingParagraph>
        <div className="mt-12 relative">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            {TIMELINE.map((phase) => {
              const stage = STAGES[phase.stage - 1]
              return (
                <div key={phase.stage} className="rounded-lg border border-zinc-200 bg-white p-4" style={{ borderTopColor: stage.hex, borderTopWidth: 3 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-zinc-400">{t('Tab3.slide3.stage')} {phase.stage}</span>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.hex }} />
                  </div>
                  <div className="text-sm font-semibold text-zinc-950">{t(`Timeline.${phase.keyPrefix}Label`)}</div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-600"><span className="font-medium text-zinc-950">{t('Tab3.slide2.solved')}</span> {t(`Timeline.${phase.keyPrefix}Solved`)}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-600"><span className="font-medium text-zinc-950">{t('Tab3.slide2.lacked')}</span> {t(`Timeline.${phase.keyPrefix}Lacked`)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="relative h-16 mt-6">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-300" />
            {TIMELINE.flatMap((phase) =>
              phase.milestones.map((m, i) => {
                const stageIdx = phase.stage - 1
                const leftPct = ((stageIdx + (i + 1) * 0.5) / 4) * 100
                return (
                  <div key={`${phase.stage}-${i}`} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}>
                    <div className="h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: STAGES[stageIdx].hex }} />
                    <div className="absolute top-5 text-center whitespace-nowrap">
                      <div className="font-mono text-[10px] text-zinc-950 font-semibold">{m.year}</div>
                      <div className="text-[10px] text-zinc-500 max-w-[140px] leading-tight">{t(`Timeline.${m.milestoneKey}`)}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-12 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>{t('Tab3.slide2.timelineStart')}</span>
            <span>{t('Tab3.slide2.timelineEnd')}</span>
          </div>
        </div>
        <SourceLine sources={['McKinsey "What is AI?" 2024', 'IBM "Evolution of AI Agents" 2025']} />
      </SlideSection>

      {/* ============================================================ SLIDE 3 — DEFINITIONS ============================================================ */}
      <SlideSection slideNumber={3} kicker={t('Tab3.slide3.kicker')}>
        <ActionTitle>{t('Tab3.slide3.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide3.body')}</OrientingParagraph>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => (
            <div key={stage.n} className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col" style={{ borderTopColor: stage.hex, borderTopWidth: 3 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-zinc-400">{t('Tab3.slide3.stage')} {stage.n}</span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.hex }} />
              </div>
              <h3 className="text-base font-semibold text-zinc-950 leading-tight">{t(`Stages.${stage.keyPrefix}Name`)}</h3>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">{t(`Stages.${stage.keyPrefix}Era`)}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">{t(`Stages.${stage.keyPrefix}Also`)}</div>
              <p className="mt-3 text-xs text-zinc-700 leading-relaxed">{t(`Stages.${stage.keyPrefix}Def`)}</p>
              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">{t('Tab3.slide3.canDo')}</div>
                <ul className="space-y-0.5">
                  {[1, 2, 3].map((ci) => (
                    <li key={ci} className="text-[11px] text-zinc-600 flex items-start gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>{t(`Stages.${stage.keyPrefix}Can${ci}`)}</span>
                    </li>
                  ))}
                  {stage.n === 4 && (
                    <li className="text-[11px] text-zinc-600 flex items-start gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>{t('Stages.stage4Can4')}</span>
                    </li>
                  )}
                </ul>
              </div>
              <div className="mt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1">{t('Tab3.slide3.cantDo')}</div>
                <ul className="space-y-0.5">
                  {[1, 2, 3].map((ci) => (
                    <li key={ci} className="text-[11px] text-zinc-600 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{t(`Stages.${stage.keyPrefix}Cant${ci}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">{t('Tab3.slide3.valueCreated')}</div>
                <p className="text-[11px] text-zinc-700 leading-relaxed">{t(`Stages.${stage.keyPrefix}Value`)}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Nested pyramid */}
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-zinc-950">{t('Tab3.slide3.nestingTitle')}</h3>
          </div>
          <div className="flex flex-col items-center gap-1">
            {STAGES.slice().reverse().map((stage, i) => (
              <div key={stage.n} className="flex items-center justify-center text-white text-xs font-semibold py-2 rounded transition" style={{ backgroundColor: stage.hex, width: `${100 - i * 18}%`, minWidth: '180px' }}>
                {t('Tab3.slide3.stage')} {stage.n}: {t(`Stages.${stage.keyPrefix}Name`)}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-600 leading-relaxed">{t('Tab3.slide3.nestingBody')}</p>
        </div>
        <SourceLine sources={['Synthesis of McKinsey, VastData, Bain, Aditya Sharma (LinkedIn) 2024–2025']} />
      </SlideSection>

      {/* ============================================================ SLIDE 4 — THE LEAP ============================================================ */}
      <SlideSection slideNumber={4} kicker={t('Tab3.slide4.kicker')}>
        <ActionTitle>{t('Tab3.slide4.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide4.body')}</OrientingParagraph>
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <LoopDiagram t={t} />
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">{t('Tab3.slide4.leapsTitle')}</div>
            {CAPABILITY_LEAPS.map((leap) => (
              <div key={leap.index} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-zinc-400">0{leap.index}</span>
                  <span className="text-xs font-medium text-zinc-500 line-through">{t(`CapabilityLeaps.${leap.keyPrefix}From`)}</span>
                  <ArrowRight className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">{t(`CapabilityLeaps.${leap.keyPrefix}To`)}</span>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{t(`CapabilityLeaps.${leap.keyPrefix}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
        <SourceLine sources={['FedResources "Agentic AI: The Next Leap" 2025', 'MIT Sloan "Agentic AI, Explained" 2025', 'arXiv survey 2504.18875 (2025)']} />
      </SlideSection>

      {/* ============================================================ SLIDE 5 — COMPARISON ============================================================ */}
      <SlideSection slideNumber={5} kicker={t('Tab3.slide5.kicker')}>
        <ActionTitle>{t('Tab3.slide5.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide5.body')}</OrientingParagraph>
        <div className="mt-10 overflow-hidden rounded-xl border border-zinc-200">
          <div className="grid grid-cols-3 bg-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-600">
            <div className="p-4">{t('Tab3.slide5.colCapability')}</div>
            <div className="p-4 border-l border-zinc-200">{t('Tab3.slide5.colGenAI')}</div>
            <div className="p-4 border-l border-zinc-200 bg-emerald-50/60 text-emerald-800">{t('Tab3.slide5.colAgentic')}</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 ${i !== COMPARISON.length - 1 ? 'border-b border-zinc-200' : ''}`}>
              <div className="p-4 text-sm font-medium text-zinc-950 bg-zinc-50/40">{t(`Comparison.${row.rowPrefix}Cap`)}</div>
              <div className="p-4 border-l border-zinc-200 text-sm text-zinc-600">{t(`Comparison.${row.rowPrefix}Gen`)}</div>
              <div className="p-4 border-l border-zinc-200 text-sm text-zinc-950 bg-emerald-50/30 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{t(`Comparison.${row.rowPrefix}Agentic`)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border-l-4 border-amber-500 bg-amber-50/50 p-4">
          <p className="text-sm text-zinc-700 leading-relaxed">
            <span className="font-semibold text-zinc-950">{t('Tab3.slide5.bottomLine')}</span> {t('Tab3.slide5.bottomLineBody')}
          </p>
        </div>
        <SourceLine sources={['Bain "What Is Agentic AI" 2025']} />
      </SlideSection>

      {/* ============================================================ SLIDE 6 — AUTONOMY SPECTRUM ============================================================ */}
      <SlideSection slideNumber={6} kicker={t('Tab3.slide6.kicker')}>
        <ActionTitle>{t('Tab3.slide6.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide6.body')}</OrientingParagraph>
        <div className="mt-12">
          <div className="relative">
            <div className="grid grid-cols-6 gap-1">
              {AUTONOMY_SPECTRUM.map((lvl) => {
                const stage = lvl.autonomous ? STAGES[3] : lvl.level <= 2 ? STAGES[0] : STAGES[1]
                return (
                  <div key={lvl.level} className="rounded-md p-3 text-white text-center" style={{ backgroundColor: stage.hex }}>
                    <div className="font-mono text-xs opacity-80">L{lvl.level}</div>
                    <div className="text-sm font-semibold mt-1">{t(`AutonomySpectrum.${lvl.keyPrefix}Name`)}</div>
                    <div className="text-[10px] opacity-90 mt-1 leading-tight">{t(`AutonomySpectrum.${lvl.keyPrefix}Cap`)}</div>
                  </div>
                )
              })}
            </div>
            <div className="absolute top-0 bottom-0 flex items-center" style={{ left: '66.6%' }}>
              <div className="h-32 w-px border-l-2 border-dashed border-rose-500" />
              <div className="absolute -top-2 -translate-x-1/2 left-0.5 whitespace-nowrap">
                <div className="bg-rose-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide">{t('Tab3.slide6.threshold')}</div>
              </div>
              <div className="absolute -bottom-6 -translate-x-1/2 left-0.5 whitespace-nowrap text-[10px] text-rose-600 font-medium">{t('Tab3.slide6.thresholdSub')}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">{t('AutonomySpectrum.levelsHuman')}</div>
              <p className="text-sm text-zinc-700 leading-relaxed">{t('Tab3.slide6.levelsHumanBody')}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">{t('AutonomySpectrum.levelsLLM')}</div>
              <p className="text-sm text-zinc-700 leading-relaxed">{t('Tab3.slide6.levelsLLMBody')}</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="font-semibold text-zinc-950">{t('Tab3.slide6.cuscoPin')}</span>
            <span className="text-zinc-500">{t('Tab3.slide6.cuscoPinBody')}</span>
          </div>
        </div>
        <SourceLine sources={['Unstructured.io "Defining the Autonomous Enterprise" 2025']} />
      </SlideSection>

      {/* ============================================================ SLIDE 7 — MARKET TIMING ============================================================ */}
      <SlideSection slideNumber={7} kicker={t('Tab3.slide7.kicker')}>
        <ActionTitle>{t('Tab3.slide7.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide7.body')}</OrientingParagraph>
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7"><HypeCycleDiagram t={t} /></div>
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">{t('Tab3.slide7.statsTitle')}</div>
            {MARKET_STATS.map((stat, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4 flex items-baseline gap-4">
                <div className="font-mono text-3xl md:text-4xl font-medium tabular-nums text-emerald-700 flex-shrink-0">{t(`MarketStats.${stat.keyPrefix}Value`)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-700 leading-snug">{t(`MarketStats.${stat.keyPrefix}Caption`)}</div>
                  <div className="text-[10px] text-zinc-400 mt-1 font-mono">{t(`MarketStats.${stat.keyPrefix}Source`)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <SourceLine sources={['Gartner 2025 Hype Cycle press release', 'Gartner 2026 CIO Survey', 'Stanford HAI AI Index 2025', 'Deloitte State of AI 2026']} />
      </SlideSection>

      {/* ============================================================ SLIDE 8 — ENTERPRISE REALITY ============================================================ */}
      <SlideSection slideNumber={8} kicker={t('Tab3.slide8.kicker')}>
        <ActionTitle>{t('Tab3.slide8.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide8.body')}</OrientingParagraph>
        <div className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            {MATURITY_LADDER.map((step) => {
              const heightClass = step.step === 1 ? 'h-32' : step.step === 2 ? 'h-40' : step.step === 3 ? 'h-48' : step.step === 4 ? 'h-56' : 'h-64'
              const tone = step.step <= 2 ? 'bg-zinc-400' : step.step === 3 ? 'bg-amber-500' : step.step === 4 ? 'bg-emerald-500' : 'bg-emerald-600'
              const isYouHere = step.step === 3
              return (
                <div key={step.step} className="flex flex-col">
                  {isYouHere && <div className="text-center mb-2"><Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-mono uppercase tracking-wide">{t('Tab3.slide8.youAreHere')}</Badge></div>}
                  <div className={`${heightClass} ${tone} rounded-t-lg p-3 text-white flex flex-col justify-end`}>
                    <div className="font-mono text-xs opacity-80">{t('Tab3.slide3.stage')} {step.step}</div>
                    <div className="text-sm font-semibold mt-1 leading-tight">{t(`MaturityLadder.${step.keyPrefix}Name`)}</div>
                    <div className="text-[10px] opacity-90 mt-1 leading-tight">{t(`MaturityLadder.${step.keyPrefix}Def`)}</div>
                    <div className="text-[10px] mt-2 font-mono opacity-80">{t(`MaturityLadder.${step.keyPrefix}Reached`)}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 relative">
            <div className="h-6 bg-amber-100 rounded flex items-center justify-center text-[10px] font-mono text-amber-800 font-semibold uppercase tracking-wide" style={{ width: '60%', marginLeft: '20%' }}>{t('Tab3.slide8.bracket')}</div>
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`rounded-lg border p-4 ${i === 3 ? 'border-amber-200 bg-amber-50/40' : 'border-zinc-200 bg-white'}`}>
                <div className={`font-mono text-2xl font-medium tabular-nums ${i === 3 ? 'text-amber-700' : 'text-zinc-950'}`}>{t(`Tab3.slide8.stat${i}Value`)}</div>
                <div className="text-xs text-zinc-500 mt-1">{t(`Tab3.slide8.stat${i}Label`)}</div>
                <div className="text-[10px] text-zinc-400 mt-1">Deloitte 2026</div>
              </div>
            ))}
          </div>
        </div>
        <SourceLine sources={['BCG "The AI Adoption Puzzle" 2025', 'Deloitte "State of AI in the Enterprise" 2026']} />
      </SlideSection>

      {/* ============================================================ SLIDE 9 — PROJECT MAPPING ============================================================ */}
      <SlideSection slideNumber={9} kicker={t('Tab3.slide9.kicker')}>
        <ActionTitle>{t('Tab3.slide9.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide9.body')}</OrientingParagraph>
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <LoopDiagram t={t} annotated />
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">{t('Tab3.slide9.mappingTitle')}</div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2"><Cpu className="h-4 w-4 text-emerald-600" /><span className="text-sm font-semibold text-zinc-950">{t('Tab3.slide9.analyticsLayer')}</span></div>
              <p className="text-xs text-zinc-600 leading-relaxed">{t('Tab3.slide9.analyticsBody')}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-emerald-600" /><span className="text-sm font-semibold text-zinc-950">{t('Tab3.slide9.agenticLayer')}</span></div>
              <p className="text-xs text-zinc-600 leading-relaxed">{t('Tab3.slide9.agenticBody')}</p>
            </div>
            <div className="rounded-lg border-l-4 border-emerald-600 bg-emerald-50/40 p-4">
              <p className="text-sm text-zinc-700 leading-relaxed"><span className="font-semibold text-zinc-950">{t('Tab3.slide9.proofTitle')}</span> {t('Tab3.slide9.proofBody')}</p>
            </div>
            <Button onClick={onTryPrototype} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">{t('Tab3.slide9.ctaPrototype')}<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
        <SourceLine sources={['Project architecture (worklog 0-b, 0-c)', 'MIT Sloan "Agentic AI, Explained" 2025']} />
      </SlideSection>

      {/* ============================================================ SLIDE 10 — STRATEGIC IMPERATIVE ============================================================ */}
      <SlideSection slideNumber={10} kicker={t('Tab3.slide10.kicker')}>
        <ActionTitle>{t('Tab3.slide10.title')}</ActionTitle>
        <OrientingParagraph>{t('Tab3.slide10.body')}</OrientingParagraph>
        <div className="mt-10 rounded-xl border-l-4 border-emerald-600 bg-zinc-50 p-6 md:p-8">
          <QuoteIcon className="h-6 w-6 text-emerald-600 mb-3" />
          <p className="font-serif text-2xl md:text-3xl italic text-zinc-950 leading-snug">{t('Tab3.slide10.quote')}</p>
          <p className="mt-4 text-sm text-zinc-500">{t('Tab3.slide10.quoteAttribution')}</p>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-full bg-emerald-600 text-white text-sm font-mono flex items-center justify-center">{i}</div>
                <Target className="h-4 w-4 text-emerald-600" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-950 mb-2 leading-tight">{t(`Tab3.slide10.action${i}Title`)}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{t(`Tab3.slide10.action${i}Body`)}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-zinc-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">{t('Tab3.slide10.sourcesTitle')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {SOURCES.map((src, i) => (
              <div key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                <span className="font-mono text-zinc-400 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span><span className="font-semibold text-zinc-950">{src.tag}</span> — {src.title} ({src.year})</span>
              </div>
            ))}
          </div>
        </div>
      </SlideSection>

      {/* Closing CTA */}
      <section className="bg-emerald-700 text-white">
        <div className="mx-auto max-w-6xl px-6 md:px-12 py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl leading-tight max-w-2xl">{t('Tab3.cta.title')}</h2>
            <p className="mt-2 text-sm text-emerald-100 max-w-2xl">{t('Tab3.cta.body')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onTryPrototype} size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50"><Zap className="mr-2 h-4 w-4" />{t('Tab3.cta.buttonPrototype')}</Button>
            <Button onClick={() => handleDownloadPptx('v1')} disabled={downloading} size="lg" variant="outline" className="border-white text-white hover:bg-emerald-800 hover:text-white bg-transparent">
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {downloading ? t('Tab3.download.generating') : t('Tab3.download.ctaButton')}
            </Button>
            <Button onClick={() => handleDownloadPptx('v2')} disabled={downloadingV2} size="lg" variant="outline" className="border-amber-300 text-amber-200 hover:bg-amber-900/30 hover:text-white bg-transparent">
              {downloadingV2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {downloadingV2 ? t('Tab3.download.generating') : `${t('Tab3.download.ctaButton')} V2`}
            </Button>
            <Button onClick={onSeeOverview} size="lg" variant="outline" className="border-white text-white hover:bg-emerald-800 hover:text-white bg-transparent">{t('Tab3.cta.buttonArchitecture')}</Button>
          </div>
        </div>
      </section>
    </main>
  )
}

/* ============================================================ Sub-components ============================================================ */

function SlideSection({ slideNumber, kicker, children }: { slideNumber: number; kicker: string; children: React.ReactNode }) {
  return (
    <section className="relative border-b border-zinc-200 min-h-[88vh] flex flex-col justify-center">
      <div className="absolute top-6 right-6 md:right-12 font-mono text-xs text-zinc-400">{String(slideNumber).padStart(2, '0')} / {TOTAL_SLIDES}</div>
      <div className="mx-auto max-w-6xl w-full px-6 md:px-12 py-16 md:py-24">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-3">{kicker}</div>
        {children}
      </div>
    </section>
  )
}

function ActionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-tight text-zinc-950 max-w-4xl">{children}</h2>
}

function OrientingParagraph({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-base md:text-lg text-zinc-600 max-w-3xl leading-relaxed">{children}</p>
}

function SourceLine({ sources }: { sources: string[] }) {
  return <div className="mt-12 pt-4 border-t border-zinc-100 text-xs text-zinc-400 font-mono">Source: {sources.join(' · ')}</div>
}

function ScrCard({ label, icon, body, tone }: { label: string; icon: React.ReactNode; body: string; tone: 'zinc' | 'amber' | 'emerald' }) {
  const toneClasses = { zinc: 'bg-white text-zinc-950', amber: 'bg-amber-50 text-zinc-950', emerald: 'bg-emerald-50 text-zinc-950' }[tone]
  const labelColor = { zinc: 'text-zinc-500', amber: 'text-amber-700', emerald: 'text-emerald-700' }[tone]
  return (
    <div className={`p-4 ${toneClasses}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${labelColor}`}>{icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span></div>
      <p className="text-xs leading-relaxed text-zinc-700">{body}</p>
    </div>
  )
}

function BigStat({ value, label, tone }: { value: string; label: string; tone: 'zinc' | 'emerald' }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className={`font-serif text-3xl md:text-4xl tabular-nums ${tone === 'emerald' ? 'text-emerald-700' : 'text-zinc-950'}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function LoopDiagram({ t, annotated }: { t: ReturnType<typeof useTranslations>; annotated?: boolean }) {
  const nodes = [
    { name: 'Perceive', icon: <Eye className="h-5 w-5" />, angle: 0 },
    { name: 'Reason', icon: <Brain className="h-5 w-5" />, angle: 90 },
    { name: 'Act', icon: <Zap className="h-5 w-5" />, angle: 180 },
    { name: 'Reflect', icon: <RefreshCw className="h-5 w-5" />, angle: 270 },
  ]
  const size = 320
  const center = size / 2
  const radius = 110
  const annotations = annotated ? [
    { node: 'Perceive', label: 'Multi-model ensemble', detail: 'COCO-SSD + HF models (Fire ViT, CLIP, SegFormer, Pose) — user-selectable' },
    { node: 'Reason', label: 'Rule engine + LLM-as-judge', detail: 'z-score + sustain counter → tier 0–3 decision' },
    { node: 'Act', label: 'Tool registry', detail: 'log, snapshot, email, escalate, generate report' },
    { node: 'Reflect', label: 'LLM verdict feedback', detail: 'real/false_positive → tunes next-tick sensitivity' },
  ] : null

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#059669" strokeWidth={2} strokeDasharray="4 3" opacity={0.4} />
        <text x={center} y={center - 8} textAnchor="middle" className="font-serif" fontSize={13} fill="#27272a">{t('Tab3.slide4.loopCenter')}</text>
        <text x={center} y={center + 8} textAnchor="middle" className="font-serif" fontSize={13} fill="#27272a">{t('Tab3.slide4.loopCenter2')}</text>
        <text x={center} y={center + 26} textAnchor="middle" fontSize={9} fill="#a1a1aa" fontFamily="ui-monospace, monospace">{t('Tab3.slide4.loopSub')}</text>
        {nodes.map((node, i) => {
          const angleRad = (node.angle * Math.PI) / 180
          const x = center + radius * Math.cos(angleRad)
          const y = center + radius * Math.sin(angleRad)
          const annotation = annotations?.find((a) => a.node === node.name)
          const nodeColor = annotation ? '#059669' : '#52525b'
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={28} fill="white" stroke={nodeColor} strokeWidth={2} />
              <text x={x} y={y - 22} textAnchor="middle" fontSize={9} fill={nodeColor} fontWeight={600} fontFamily="ui-monospace, monospace">{String(i + 1).padStart(2, '0')}</text>
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#27272a" fontWeight={600}>{node.name}</text>
              {i < 4 && <text x={center + radius * 0.7 * Math.cos((node.angle + 45) * Math.PI / 180)} y={center + radius * 0.7 * Math.sin((node.angle + 45) * Math.PI / 180)} textAnchor="middle" fontSize={14} fill="#059669" opacity={0.6}>→</text>}
            </g>
          )
        })}
      </svg>
      {annotations && (
        <div className="mt-4 w-full space-y-2">
          {annotations.map((a, i) => (
            <div key={i} className="rounded-md border border-zinc-200 bg-zinc-50/50 p-2">
              <div className="flex items-center gap-2"><span className="text-xs font-semibold text-emerald-700">{a.node}</span><span className="text-xs font-mono text-zinc-950">{a.label}</span></div>
              <p className="text-[10px] text-zinc-600 mt-0.5">{a.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HypeCycleDiagram({ t }: { t: ReturnType<typeof useTranslations> }) {
  const w = 560
  const h = 240
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-950">{t('Tab3.slide7.chartTitle')}</h3>
        <Badge variant="outline" className="text-[10px] font-mono">5 phases</Badge>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <line x1={40} y1={h - 30} x2={w - 20} y2={h - 30} stroke="#e4e4e7" />
        <path d={`M 40 ${h - 60} C 120 ${h - 200}, 180 ${h - 200}, 240 ${h - 110} C 280 ${h - 50}, 320 ${h - 70}, 360 ${h - 90} C 420 ${h - 110}, 480 ${h - 80}, ${w - 20} ${h - 50}`} fill="none" stroke="#52525b" strokeWidth={2} />
        {['Innovation\nTrigger', 'Peak of\nInflated Exp.', 'Trough of\nDisillusionment', 'Slope of\nEnlightenment', 'Plateau of\nProductivity'].map((label, i) => (
          <text key={i} x={50 + i * 120} y={h - 12} textAnchor="middle" fontSize={8} fill="#71717a" fontFamily="ui-monospace, monospace">{label.split('\n')[0]}</text>
        ))}
        {[
          { x: 220, y: h - 200, label: 'AI Agents', sub: 'Peak — 2025', color: '#f59e0b' },
          { x: 300, y: h - 65, label: 'GenAI', sub: 'Trough — 2025', color: '#71717a' },
          { x: 410, y: h - 100, label: 'AI Engineering', sub: 'Slope', color: '#059669' },
          { x: 130, y: h - 130, label: 'Agentic Governance', sub: 'Trigger', color: '#a1a1aa' },
        ].map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r={5} fill={m.color} stroke="white" strokeWidth={2} />
            <text x={m.x} y={m.y - 12} textAnchor="middle" fontSize={10} fontWeight={600} fill="#27272a">{m.label}</text>
            <text x={m.x} y={m.y - 24} textAnchor="middle" fontSize={8} fill="#71717a" fontFamily="ui-monospace, monospace">{m.sub}</text>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-xs text-zinc-500 leading-relaxed">{t('Tab3.slide7.chartBody')}</p>
    </div>
  )
}
