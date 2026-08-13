'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Brain, Network, Workflow, Play, Pause, SkipForward, SkipBack,
  RotateCw, Zap, Shield, Flame, Moon, Users, Package, Eye, Waves,
  Mountain, Building, TrafficCone, UserCheck, List, Car, ShoppingBag,
  Radar, Target, TrendingUp, AlertTriangle, Cpu, Gauge, Layers,
  Download, MousePointerClick, Info, FileImage, Command, GitCompare, Keyboard,
  Minimize2, Maximize2, ChevronRight, Compass, Settings,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EntityCorrelationGraph } from '@/components/vision/entity-correlation-graph'
import { AgentDecisionFlow } from '@/components/vision/agent-decision-flow'
import { Heartbeat } from '@/components/vision/heartbeat'
import { CorrelationMatrix } from '@/components/vision/correlation-matrix'
import { NodeInspector, stageIdFor } from '@/components/vision/node-inspector'
import { CompareView } from '@/components/vision/compare-view'
import { CommandPalette } from '@/components/vision/command-palette'
import { TimeWindowAnalytics } from '@/components/vision/time-window-analytics'
import { LiveTicker } from '@/components/vision/live-ticker'
import { ShortcutHelp } from '@/components/vision/shortcut-help'
import { OnboardingTour } from '@/components/vision/onboarding-tour'
import { SettingsPanel, DEFAULT_SETTINGS } from '@/components/vision/settings-panel'
import type { DashboardSettings } from '@/components/vision/settings-panel'
import { useLocalStorage } from '@/lib/vision/use-local-storage'
import { useLiveData } from '@/lib/vision/use-live-data'
import type { LiveTick } from '@/lib/vision/use-live-data'
import { USE_CASES, LEVEL_META, USE_CASE_BY_ID } from '@/lib/vision/use-cases'
import { getEntityNetwork, KIND_META, mergeLiveTicks } from '@/lib/vision/entity-network'
import { generateAgentRun, NODE_BY_ID } from '@/lib/vision/agent-flow'
import { TIER_META } from '@/lib/vision/types'
import type { UseCase, AgentFlowRun, EntityKind, Tier } from '@/lib/vision/types'

const UC_ICONS: Record<string, LucideIcon> = {
  shield: Shield, moon: Moon, users: Users, car: Car, list: List, package: Package,
  eye: Eye, activity: Activity, 'shopping-bag': ShoppingBag, flame: Flame, waves: Waves,
  mountain: Mountain, building: Building, 'traffic-cone': TrafficCone, 'user-check': UserCheck,
}

export default function Home() {
  const baseNetwork = useMemo(() => getEntityNetwork(), [])
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string>('shoplifting')
  const [cycle, setCycle] = useState(1)
  // Run is derived from the selected use case + cycle (no setState-in-effect needed)
  const selectedUseCase = USE_CASE_BY_ID[selectedUseCaseId] as UseCase
  const run = useMemo(() => generateAgentRun(selectedUseCase, cycle), [selectedUseCase, cycle])
  const [activeStep, setActiveStep] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [settings, setSettings] = useLocalStorage<DashboardSettings>('vap:settings', DEFAULT_SETTINGS)
  const [speed, setSpeed] = useState(settings.defaultSpeed)
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [history, setHistory] = useLocalStorage<AgentFlowRun[]>('vap:cycle-history', [])
  const [tab, setTab] = useState('flow')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(settings.startWithLiveMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Increment to imperatively reset the flow pan/zoom (triggered by `0` hotkey).
  const [flowResetSignal, setFlowResetSignal] = useState(0)
  // Live mode drives the agent flow: when an anomaly+ tick arrives, load the
  // matching use case + auto-animate the trace so the VP sees the agent respond.
  const handleLiveAnomaly = useCallback((useCaseId: string) => {
    setTab('flow')
    setSelectedUseCaseId(useCaseId)
    setCycle((c) => c + 1)
    setActiveStep(-1)
    requestAnimationFrame(() => setPlaying(true))
  }, [])
  const { ticks: liveTicks, clear: clearLiveTicks } = useLiveData(liveMode, handleLiveAnomaly)
  // Live ticker → correlation feed: anomaly+ live ticks become entity nodes
  // in the network so the graph visibly grows when live mode is on.
  const network = useMemo(() => {
    if (!liveMode || liveTicks.length === 0) return baseNetwork
    const liveEntities = liveTicks
      .filter((t) => t.tier >= 2 && t.useCaseId)
      .map((t) => ({
        id: String(t.id),
        label: `⚡${t.className}`,
        feedId: t.feedId,
        className: t.className,
        kind: ((): EntityKind => {
          if (t.className === 'person') return 'person'
          if (['car', 'truck', 'bus', 'motorcycle', 'forklift'].includes(t.className)) return 'vehicle'
          if (['fire', 'smoke', 'debris'].includes(t.className)) return 'hazard'
          if (['water'].includes(t.className)) return 'environment'
          return 'object'
        })(),
        z: t.z,
        tier: t.tier,
        ts: t.ts,
      }))
    return mergeLiveTicks(baseNetwork, liveEntities)
  }, [baseNetwork, liveMode, liveTicks])
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourSeen, setTourSeen] = useLocalStorage('vap:tour-seen', false)
  const [tourOpen, setTourOpen] = useState(false)
  const closeTour = useCallback(() => { setTourOpen(false); setTourSeen(true) }, [setTourSeen])

  // Network graph controls
  const [minCorrelation, setMinCorrelation] = useState(0.25)
  const [feedFilter, setFeedFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState<string>('all')

  // When the use case / cycle changes, reset playback state in the handler (not effect)
  const selectUseCase = useCallback((id: string) => {
    setSelectedUseCaseId(id)
    setActiveStep(-1)
    setPlaying(false)
  }, [])
  const nextCycle = useCallback(() => {
    setCycle((c) => c + 1)
    setActiveStep(-1)
    setPlaying(false)
  }, [])

  // Play/pause autoplay through stages — record history when a trace completes
  useEffect(() => {
    if (!playing) {
      if (playRef.current) clearInterval(playRef.current)
      return
    }
    playRef.current = setInterval(() => {
      setActiveStep((s) => {
        if (s >= run.trace.length - 1) {
          setPlaying(false)
          // record completed run into history
          setHistory((h) => [{ ...run }, ...h].slice(0, 6))
          return s
        }
        return s + 1
      })
    }, 1100 / speed)
    return () => {
      if (playRef.current) clearInterval(playRef.current)
    }
  }, [playing, run, speed])

  const stepForward = useCallback(() => {
    setActiveStep((s) => Math.min(run.trace.length - 1, s + 1))
  }, [run])
  const stepBack = useCallback(() => {
    setActiveStep((s) => Math.max(-1, s - 1))
  }, [])
  const reset = useCallback(() => {
    setActiveStep(-1)
    setPlaying(false)
  }, [])
  const togglePlay = useCallback(() => setPlaying((p) => !p), [])

  // Replay a logged cycle: load the exact use case + cycle, then auto-play.
  // generateAgentRun is deterministic (seeded by useCaseId + cycle), so the
  // same inputs reproduce the identical trace.
  const replayHistory = useCallback((useCaseId: string, cycleNum: number) => {
    setSelectedUseCaseId(useCaseId)
    setCycle(cycleNum)
    setActiveStep(-1)
    // Defer play so the new run is rendered first.
    requestAnimationFrame(() => setPlaying(true))
  }, [])

  // Select a flow node (from the graph OR the command palette) + scroll the
  // flow container to center the node horizontally.
  const handleSelectFlowNode = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id))
    // Defer the scroll so the SVG renders with the new selection first.
    requestAnimationFrame(() => {
      const svg = document.querySelector('[data-testid="agent-flow-svg"]') as SVGSVGElement | null
      if (!svg) return
      const nodeText = Array.from(svg.querySelectorAll('text')).find((t) => t.textContent === NODE_BY_ID[id]?.label)
      if (!nodeText) return
      const g = nodeText.closest('g')
      if (!g) return
      const r = (g as SVGGElement).getBoundingClientRect()
      const container = svg.parentElement // the overflow-x-auto div
      if (!container) return
      const targetLeft = container.scrollLeft + (r.left - container.getBoundingClientRect().left) - container.clientWidth / 2 + r.width / 2
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    })
  }, [])

  // Export the agent decision flow SVG as a downloadable .svg file
  const exportFlowSvg = useCallback(() => {
    const svg = document.querySelector('[data-testid="agent-flow-svg"]') as SVGSVGElement | null
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const data = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vision-agent-flow-${selectedUseCaseId}-cycle${cycle}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [selectedUseCaseId, cycle])

  // Export the agent decision flow as a downloadable .png file
  const exportFlowPng = useCallback(() => {
    const svg = document.querySelector('[data-testid="agent-flow-svg"]') as SVGSVGElement | null
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const data = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2 // retina-quality
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return }
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `vision-agent-flow-${selectedUseCaseId}-cycle${cycle}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
    }
    img.src = url
  }, [selectedUseCaseId, cycle])

  // Command palette (⌘K / Ctrl+K)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const selectedNode = selectedNodeId ? NODE_BY_ID[selectedNodeId] ?? null : null

  // Keyboard shortcuts: space=play/pause, ←/→=step, r=reset, n=next cycle,
  // esc=close inspector/palette/help, ⌘K/Ctrl+K=command palette, ?=help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K toggles the palette (works even when focused on inputs)
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        // allow Escape to close help/palette even from inputs
        if (e.code === 'Escape') { setHelpOpen(false); setPaletteOpen(false) }
        return
      }
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.code === 'ArrowRight') { e.preventDefault(); stepForward() }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); stepBack() }
      else if (e.code === 'KeyR') { reset() }
      else if (e.code === 'KeyN') { nextCycle() }
      else if (e.code === 'Escape') { setSelectedNodeId(null); setPaletteOpen(false); setHelpOpen(false); setSettingsOpen(false) }
      else if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) { e.preventDefault(); setHelpOpen((o) => !o) }
      else if (e.key === ',' || e.code === 'Comma') { e.preventDefault(); setSettingsOpen((o) => !o) }
      else if (e.key === '0' || e.code === 'Digit0') { e.preventDefault(); setFlowResetSignal((s) => s + 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, stepForward, stepBack, reset, nextCycle])

  // Stats
  const stats = useMemo(() => {
    const tierCounts: Record<Tier, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
    network.nodes.forEach((n) => { tierCounts[n.tier]++ })
    const hazardNodes = network.nodes.filter((n) => n.kind === 'hazard')
    const avgCorrelation =
      network.edges.reduce((s, e) => s + e.correlationScore, 0) / Math.max(1, network.edges.length)
    return {
      totalEntities: network.nodes.length,
      totalFeeds: network.feeds.length,
      totalEdges: network.edges.length,
      avgCorrelation,
      tierCounts,
      hazards: hazardNodes.length,
    }
  }, [network])

  const rankedEdges = useMemo(
    () => [...network.edges].sort((a, b) => b.correlationScore - a.correlationScore).slice(0, 8),
    [network],
  )
  const nodeById = useMemo(() => new Map(network.nodes.map((n) => [n.id, n])), [network])

  return (
    <div className={`min-h-screen flex flex-col bg-slate-950 text-slate-100 ${settings.presentationMode ? 'presentation-mode' : ''}`}>
      {/* ─── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600 shadow-lg shadow-rose-500/30">
              <Radar className="h-5 w-5 text-white" />
              <motion.span
                className="absolute inset-0 rounded-xl ring-2 ring-amber-400/50"
                animate={{ opacity: [0.7, 0.1, 0.7], scale: [1, 1.08, 1] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-none">
                Vision Agent <span className="text-amber-400">Perú</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5">
                Agentic Intelligence · Correlation Network · Decision Flow
              </p>
            </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1">
              <Heartbeat active={playing || liveMode} width={150} height={28} />
            </div>
            <StatusPill icon={Cpu} label="Models" value="4 feeds · 6 detectors" tone="sky" />
            <StatusPill icon={Gauge} label="Avg correlation" value={stats.avgCorrelation.toFixed(2)} tone="emerald" />
            <StatusPill icon={AlertTriangle} label="Hazards" value={String(stats.hazards)} tone="rose" />
            <StatusPill icon={Activity} label="Agent cycles" value={String(cycle)} tone="amber" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              aria-label="Open command palette"
            >
              <Command className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden xl:inline rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[9px] font-mono">⌘K</kbd>
            </button>
            <button
              onClick={() => setHelpOpen(true)}
              className="grid place-items-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-amber-300 transition"
              aria-label="Show keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTourOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-violet-300 transition"
              aria-label="Start guided tour"
              title="Guided tour"
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Tour</span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="grid place-items-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-sky-300 transition"
              aria-label="Open settings"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* mobile buttons */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="md:hidden grid place-items-center h-9 w-9 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"
            aria-label="Open command palette"
          >
            <Command className="h-4 w-4" />
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            className="md:hidden grid place-items-center h-9 w-9 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-amber-300"
            aria-label="Show keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-5 space-y-5">
        {/* Executive summary strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard icon={Network} label="Entities tracked" value={stats.totalEntities} sub={`${stats.totalFeeds} live feeds`} accent="#38bdf8" />
          <SummaryCard icon={Layers} label="Correlations" value={stats.totalEdges} sub={`avg ρ ${stats.avgCorrelation.toFixed(2)}`} accent="#22d3ee" />
          <SummaryCard icon={Target} label="Use cases" value={USE_CASES.length} sub="commercial + disaster" accent="#a78bfa" />
          <SummaryCard icon={Shield} label="Tier 0 (nominal)" value={stats.tierCounts[0]} sub="healthy" accent={TIER_META[0].color} />
          <SummaryCard icon={Gauge} label="Tier 2 (anomaly)" value={stats.tierCounts[2]} sub="action needed" accent={TIER_META[2].color} />
          <SummaryCard icon={AlertTriangle} label="Tier 3 (critical)" value={stats.tierCounts[3]} sub="escalation" accent={TIER_META[3].color} />
        </section>

        {/* Tabs: Network | Agent Flow */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <TabsList className="bg-slate-900 border border-slate-800 h-auto p-1">
              <TabsTrigger value="flow" className="data-[state=active]:bg-slate-800 data-[state=active]:text-amber-300 gap-1.5 text-xs sm:text-sm">
                <Workflow className="h-4 w-4" /> <span className="hidden sm:inline">Agent</span> Flow
              </TabsTrigger>
              <TabsTrigger value="network" className="data-[state=active]:bg-slate-800 data-[state=active]:text-sky-300 gap-1.5 text-xs sm:text-sm">
                <Network className="h-4 w-4" /> <span className="hidden sm:inline">Correlation</span> Network
              </TabsTrigger>
              <TabsTrigger value="compare" className="data-[state=active]:bg-slate-800 data-[state=active]:text-violet-300 gap-1.5 text-xs sm:text-sm">
                <GitCompare className="h-4 w-4" /> <span className="hidden sm:inline">Compare</span>
              </TabsTrigger>
            </TabsList>
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> live · 1 Hz agent loop
              </span>
              <span className="text-slate-600">|</span>
              <span>ref: pillb/vision-agent-peru</span>
            </div>
          </div>

          {/* ───────────── AGENT DECISION FLOW TAB ───────────── */}
          <TabsContent value="flow" className="space-y-4 mt-0">
            <AgentFlowPanel
              run={run}
              activeStep={activeStep}
              playing={playing}
              speed={speed}
              useCase={selectedUseCase}
              cycle={cycle}
              useCases={USE_CASES}
              selectedUseCaseId={selectedUseCaseId}
              onSelectUseCase={selectUseCase}
              onStepForward={stepForward}
              onStepBack={stepBack}
              onReset={reset}
              onPlayPause={togglePlay}
              onSpeed={setSpeed}
              onNextCycle={nextCycle}
              history={history}
              onReplay={replayHistory}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleSelectFlowNode}
              onExport={exportFlowSvg}
              onExportPng={exportFlowPng}
              liveTicks={liveTicks}
              liveMode={liveMode}
              onToggleLive={() => setLiveMode((v) => !v)}
              onClearLive={clearLiveTicks}
              initialCollapsed={settings.flowCollapsed}
              flowResetSignal={flowResetSignal}
            />
          </TabsContent>

          {/* ───────────── CORRELATION NETWORK TAB ───────────── */}
          <TabsContent value="network" className="space-y-4 mt-0">
            <TimeWindowAnalytics network={network} />
            <CorrelationNetworkPanel
              network={network}
              minCorrelation={minCorrelation}
              feedFilter={feedFilter}
              kindFilter={kindFilter}
              onMinCorrelation={setMinCorrelation}
              onFeedFilter={setFeedFilter}
              onKindFilter={setKindFilter}
              rankedEdges={rankedEdges}
              nodeById={nodeById}
            />
            {/* Per-feed correlation matrix */}
            <CorrelationMatrix network={network} />
          </TabsContent>

          {/* ───────────── COMPARE USE CASES TAB ───────────── */}
          <TabsContent value="compare" className="space-y-4 mt-0">
            <CompareView />
          </TabsContent>
        </Tabs>

        {/* Use case gallery */}
        <UseCaseGallery
          useCases={USE_CASES}
          selectedId={selectedUseCaseId}
          onSelect={selectUseCase}
        />
      </main>

      {/* ─── Node detail inspector drawer ──────────────────────────── */}
      <NodeInspector node={selectedNode} run={run} onClose={() => setSelectedNodeId(null)} />

      {/* ─── Command palette (⌘K) ─────────────────────────────────── */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelectUseCase={selectUseCase}
        onSelectFlowNode={handleSelectFlowNode}
        onSwitchTab={setTab}
      />

      {/* ─── Keyboard shortcut help (?) ───────────────────────────── */}
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />

      {/* ─── Onboarding tour ──────────────────────────────────────── */}
      {tourOpen && <OnboardingTour key="tour" open={tourOpen} onOpenChange={(o) => { if (o) setTourOpen(true); else closeTour() }} onSwitchTab={setTab} />}

      {/* ─── Settings panel ───────────────────────────────────────── */}
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={setSettings} />

      {/* ─── Footer (sticky) ─────────────────────────────────────── */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <Brain className="h-3.5 w-3.5 text-amber-400" />
            9-stage agentic loop · perceive → validate → policy → judge → propose → approve → execute → verify
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Capability ladder:</span>
            {Object.entries(LEVEL_META).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
                <span className="capitalize">{v.label}</span>
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function StatusPill({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: 'sky' | 'emerald' | 'rose' | 'amber' }) {
  const tones = {
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  }[tone]
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${tones}`}>
      <Icon className="h-3.5 w-3.5" />
      <div className="leading-none">
        <div className="text-[9px] uppercase tracking-wide opacity-70">{label}</div>
        <div className="text-xs font-mono font-semibold mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: number; sub: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      </div>
      <div className="mt-2 text-2xl font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  )
}

// ─── Agent Flow Panel ───────────────────────────────────────────────────────
function AgentFlowPanel(props: {
  run: AgentFlowRun
  activeStep: number
  playing: boolean
  speed: number
  useCase: UseCase
  cycle: number
  useCases: UseCase[]
  selectedUseCaseId: string
  onSelectUseCase: (id: string) => void
  onStepForward: () => void
  onStepBack: () => void
  onReset: () => void
  onPlayPause: () => void
  onSpeed: (s: number) => void
  onNextCycle: () => void
  history: AgentFlowRun[]
  onReplay: (useCaseId: string, cycle: number) => void
  selectedNodeId: string | null
  onNodeClick: (id: string) => void
  onExport: () => void
  onExportPng: () => void
  liveTicks: LiveTick[]
  liveMode: boolean
  onToggleLive: () => void
  onClearLive: () => void
  initialCollapsed?: boolean
  flowResetSignal?: number
}) {
  const { run, activeStep, playing, speed, useCase, cycle, useCases, selectedUseCaseId, onSelectUseCase, onStepForward, onStepBack, onReset, onPlayPause, onSpeed, onNextCycle, history, onReplay, selectedNodeId, onNodeClick, onExport, onExportPng, liveTicks, liveMode, onToggleLive, onClearLive, initialCollapsed, flowResetSignal } = props
  const activeTrace = activeStep >= 0 && activeStep < run.trace.length ? run.trace[activeStep] : null
  const [flowCollapsed, setFlowCollapsed] = useState(initialCollapsed ?? false)

  return (
    <div className={`grid grid-cols-1 gap-4 ${flowCollapsed ? 'min-[1960px]:grid-cols-[1fr_440px]' : 'min-[1960px]:grid-cols-[1fr_340px]'}`}>
      {/* Flow canvas + controls */}
      <div className="space-y-3 min-w-0">
        {/* use case selector strip */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Active Use Case</h2>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300 font-mono">{useCase.ruleType}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">cycle #{cycle}</span>
              <button
                onClick={() => setFlowCollapsed((c) => !c)}
                className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition"
                aria-label={flowCollapsed ? 'Expand flow canvas' : 'Collapse flow canvas'}
                title={flowCollapsed ? 'Expand flow canvas' : 'Collapse to monitoring view'}
              >
                {flowCollapsed ? <><Maximize2 className="h-3 w-3" /> Expand</> : <><Minimize2 className="h-3 w-3" /> Collapse</>}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {useCases.map((uc) => {
              const Icon = UC_ICONS[uc.icon] ?? Activity
              const active = uc.id === selectedUseCaseId
              const lvl = LEVEL_META[uc.level]
              return (
                <button
                  key={uc.id}
                  onClick={() => onSelectUseCase(uc.id)}
                  className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-all ${
                    active
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-200 shadow-md shadow-amber-500/10'
                      : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3 w-3 opacity-80" />
                  <span className="truncate max-w-[120px]">{uc.nameEn}</span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: lvl.color }} title={lvl.label} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Compact playback bar (collapsed monitoring mode) */}
        {flowCollapsed && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-7 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold" onClick={onPlayPause}>
              {playing ? <><Pause className="h-3 w-3 mr-1" />Pause</> : <><Play className="h-3 w-3 mr-1" />Play</>}
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-slate-700 bg-slate-800" onClick={onStepBack} disabled={activeStep < 0}>
              <SkipBack className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-slate-700 bg-slate-800" onClick={onStepForward} disabled={activeStep >= run.trace.length - 1}>
              <SkipForward className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 border-slate-700 bg-slate-800 text-xs gap-1" onClick={onNextCycle}>
              <Zap className="h-3 w-3 text-amber-400" /> Next
            </Button>
            <span className="text-[10px] font-mono text-slate-500 ml-auto">
              step {Math.max(0, activeStep + 1)}/{run.trace.length} · T{run.finalTier} · {run.finalOutcome}
            </span>
          </div>
        )}

        {/* Flow viz + playback (hidden in collapsed monitoring mode) */}
        {!flowCollapsed && (
        <>
        {/* Flow viz */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden relative">
          {/* floating hint + export */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-[9px] font-mono text-slate-400 backdrop-blur">
              <MousePointerClick className="h-3 w-3 text-sky-400" />
              click a node for detail
            </div>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onExport}
                    className="grid place-items-center h-7 w-7 rounded-md border border-slate-700 bg-slate-950/80 text-slate-400 hover:text-sky-300 hover:border-sky-500/50 transition backdrop-blur"
                    aria-label="Export flow as SVG"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Export current flow as SVG</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onExportPng}
                    className="grid place-items-center h-7 w-7 rounded-md border border-slate-700 bg-slate-950/80 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/50 transition backdrop-blur"
                    aria-label="Export flow as PNG"
                  >
                    <FileImage className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Export current flow as PNG (retina)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <AgentDecisionFlow run={run} activeStep={activeStep} selectedNodeId={selectedNodeId} onNodeClick={onNodeClick} resetSignal={flowResetSignal} />
        </div>

        {/* Playback controls */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={onStepBack} disabled={activeStep < 0}>
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold" onClick={onPlayPause}>
              {playing ? <><Pause className="h-4 w-4 mr-1.5" />Pause</> : <><Play className="h-4 w-4 mr-1.5" />Play trace</>}
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={onStepForward} disabled={activeStep >= run.trace.length - 1}>
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={onReset}>
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-700 mx-1" />
            <Button size="sm" variant="outline" className="h-8 border-slate-700 bg-slate-800 hover:bg-slate-700 gap-1.5" onClick={onNextCycle}>
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Next cycle
            </Button>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">space</kbd>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">←</kbd>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">→</kbd>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">n</kbd>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">?</kbd>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">esc</kbd>
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Speed</span>
            <div className="flex items-center gap-1">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeed(s)}
                  className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold transition ${
                    speed === s ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Reasoning side panel */}
      <div className="space-y-3 min-w-0">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-amber-400" /> Agent reasoning
            </h3>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-mono font-bold"
              style={{
                background: TIER_META[run.finalTier].color + '22',
                color: TIER_META[run.finalTier].color,
              }}
            >
              Tier {run.finalTier} · {TIER_META[run.finalTier].label}
            </span>
          </div>

          {/* ELI5 */}
          <div className="mb-3 rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">What is the agent doing?</strong> Each cycle it{' '}
            <span className="text-sky-300">perceives</span> → <span className="text-violet-300">validates</span> →{' '}
            <span className="text-amber-300">decides a tier</span> → optionally asks a{' '}
            <span className="text-fuchsia-300">VLM judge</span> → <span className="text-emerald-300">proposes & executes actions</span> →{' '}
            <span className="text-teal-300">verifies the outcome</span>. Watch the nodes light up along the actual decision path.
          </div>

          {/* active stage detail */}
          <AnimatePresence mode="wait">
            {activeTrace ? (
              <motion.div
                key={activeTrace.stage + activeStep}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="rounded-lg border border-slate-700 bg-slate-950/70 p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-amber-300 font-mono font-bold">
                    {activeTrace.stage.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: statusColor(activeTrace.status) }}>
                    {activeTrace.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{activeTrace.reasoning}</p>
                <div className="mt-2 text-[10px] font-mono text-slate-500">{activeTrace.detail}</div>
                {activeTrace.branch && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold" style={{ background: BRANCH_BG[activeTrace.branch], color: BRANCH_FG[activeTrace.branch] }}>
                    → {activeTrace.branch}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-3 text-center text-xs text-slate-500">
                Press <span className="text-amber-400 font-semibold">Play</span> or step forward to trace the agent's decision path.
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Stage trace timeline */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-sky-400" /> Stage trace
          </h3>
          <ScrollArea className="max-h-[320px] pr-2">
            <div className="space-y-1.5">
              {run.trace.map((t, i) => {
                const isActive = i === activeStep
                const isDone = i < activeStep
                return (
                  <button
                    key={i}
                    onClick={() => props.onStepBack && i < activeStep && props.onStepBack()}
                    className={`w-full text-left rounded-lg border px-2.5 py-1.5 transition-all ${
                      isActive
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : isDone
                        ? 'border-slate-700/60 bg-slate-800/40'
                        : 'border-slate-800/60 bg-slate-950/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-300">
                        {String(i + 1).padStart(2, '0')} · {t.stage.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[9px] font-mono" style={{ color: statusColor(t.status) }}>{t.status}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{t.reasoning}</div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Outcome */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" /> Final outcome
          </h3>
          <div className="text-xs text-slate-300">
            <span className="font-mono uppercase text-emerald-300">{run.finalOutcome}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {run.finalActions.map((a) => (
              <span key={a} className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">{a}</span>
            ))}
          </div>
        </div>

        {/* Live detection stream */}
        <LiveTicker ticks={liveTicks} enabled={liveMode} onToggle={onToggleLive} onClear={onClearLive} />

        {/* Cycle history */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" /> Recent cycles
            <span className="ml-auto text-[9px] font-mono text-slate-500">{history.length} logged · saved locally</span>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition"
                aria-label="Clear cycle history"
              >
                clear
              </button>
            )}
          </h3>
          {history.length === 0 ? (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Run a full trace to completion (▶ or <kbd className="rounded border border-slate-700 bg-slate-800 px-1 text-[9px]">space</kbd>) — completed cycles will appear here as an audit log of agent decisions.
            </p>
          ) : (
            <ScrollArea className="max-h-[180px] pr-1">
              <div className="space-y-1.5">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => onReplay(h.useCaseId, h.cycle)}
                    className="w-full text-left rounded-lg border border-slate-800 bg-slate-950/40 p-2 hover:border-amber-500/40 hover:bg-amber-500/5 transition group"
                    aria-label={`Replay cycle ${h.cycle} — ${h.useCaseName}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-300 truncate group-hover:text-amber-200">{h.useCaseName}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
                        style={{ background: TIER_META[h.finalTier].color + '22', color: TIER_META[h.finalTier].color }}
                      >
                        T{h.finalTier}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-mono uppercase" style={{ color: outcomeColor(h.finalOutcome) }}>{h.finalOutcome}</span>
                      <span className="text-[9px] font-mono text-slate-500 group-hover:text-amber-300">cycle #{h.cycle} · replay ↩</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {h.finalActions.slice(0, 4).map((a) => (
                        <span key={a} className="rounded bg-slate-800/70 px-1 py-0.5 text-[8px] font-mono text-slate-400">{a}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}

function outcomeColor(o: string): string {
  switch (o) {
    case 'resolved': return '#34d399'
    case 'retry': return '#fbbf24'
    case 'compensate': return '#f87171'
    case 'pending_approval': return '#fbbf24'
    case 'suppressed': return '#94a3b8'
    default: return '#94a3b8'
  }
}

// ─── Correlation Network Panel ──────────────────────────────────────────────
function CorrelationNetworkPanel(props: {
  network: ReturnType<typeof getEntityNetwork>
  minCorrelation: number
  feedFilter: string
  kindFilter: string
  onMinCorrelation: (v: number) => void
  onFeedFilter: (v: string) => void
  onKindFilter: (v: string) => void
  rankedEdges: ReturnType<typeof getEntityNetwork>['edges']
  nodeById: Map<string, ReturnType<typeof getEntityNetwork>['nodes'][number]>
}) {
  const { network, minCorrelation, feedFilter, kindFilter, onMinCorrelation, onFeedFilter, onKindFilter, rankedEdges, nodeById } = props

  return (
    <div className="grid grid-cols-1 min-[1960px]:grid-cols-[1fr_340px] gap-4">
      <div className="space-y-3 min-w-0">
        {/* Controls */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold">Entity correlation network</h2>
          </div>
          <Separator orientation="vertical" className="h-6 bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">Min ρ</span>
            <Slider
              value={[minCorrelation]}
              onValueChange={(v) => onMinCorrelation(v[0])}
              min={0}
              max={1}
              step={0.05}
              className="w-28"
            />
            <span className="text-[11px] font-mono text-sky-300 w-8">{minCorrelation.toFixed(2)}</span>
          </div>
          <Separator orientation="vertical" className="h-6 bg-slate-700" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 mr-1">Feed</span>
            <button onClick={() => onFeedFilter('all')} className={chip(feedFilter === 'all')}>All</button>
            {network.feeds.map((f) => (
              <button key={f.feedId} onClick={() => onFeedFilter(f.feedId)} className={chip(feedFilter === f.feedId)}>
                {f.label.split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-6 bg-slate-700" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 mr-1">Kind</span>
            <button onClick={() => onKindFilter('all')} className={chip(kindFilter === 'all')}>All</button>
            {(Object.keys(KIND_META) as EntityKind[]).map((k) => (
              <button key={k} onClick={() => onKindFilter(k)} className={chip(kindFilter === k)}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_META[k].color }} />
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Graph */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <EntityCorrelationGraph
            network={network}
            minCorrelation={minCorrelation}
            feedFilter={feedFilter}
            kindFilter={kindFilter}
          />
        </div>
      </div>

      {/* Side: ranked correlations + feed roster */}
      <div className="space-y-3 min-w-0">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" /> Top correlations
          </h3>
          <ScrollArea className="max-h-[300px] pr-1">
            <div className="space-y-1.5">
              {rankedEdges.map((e, i) => {
                const a = nodeById.get(e.source)
                const b = nodeById.get(e.target)
                if (!a || !b) return null
                return (
                  <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-slate-200 truncate">{a.label} ↔ {b.label}</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-300">{e.correlationScore.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${e.correlationScore * 100}%`, background: e.crossFeed ? '#a855f7' : '#38bdf8' }} />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-slate-500">
                      <span>{e.encounterCount}× · {e.sharedFrames}f</span>
                      <span>prox {e.proximityScore.toFixed(2)} · temp {e.temporalOverlap.toFixed(2)}</span>
                      {e.crossFeed && <span className="text-purple-400">cross-feed</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Feed roster */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Radar className="h-4 w-4 text-sky-400" /> Live feeds
          </h3>
          <div className="space-y-2">
            {network.feeds.map((f) => {
              const active = feedFilter === f.feedId
              return (
                <button
                  key={f.feedId}
                  onClick={() => onFeedFilter(active ? 'all' : f.feedId)}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
                    active ? 'border-sky-500/60 bg-sky-500/10' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200">{f.label}</span>
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> live
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-slate-500">
                    <span>{f.cameraId} · {f.location}</span>
                    <span>{f.totalSubjects} subj · {f.totalFrames.toLocaleString()}f</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Use Case Gallery ───────────────────────────────────────────────────────
function UseCaseGallery({ useCases, selectedId, onSelect }: { useCases: UseCase[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold">Use case catalog</h2>
          <span className="text-[10px] text-slate-500 font-mono">{useCases.length} cases · 4 capability levels</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">click to load into the agent flow →</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {useCases.map((uc) => {
          const Icon = UC_ICONS[uc.icon] ?? Activity
          const active = uc.id === selectedId
          const lvl = LEVEL_META[uc.level]
          return (
            <button
              key={uc.id}
              onClick={() => onSelect(uc.id)}
              className={`group text-left rounded-xl border p-3 transition-all ${
                active
                  ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center h-7 w-7 rounded-lg" style={{ background: lvl.color + '22' }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: lvl.color }} />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-100 leading-tight">{uc.nameEn}</span>
                </div>
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
                  style={{ background: TIER_META[uc.tier].color + '22', color: TIER_META[uc.tier].color }}
                >
                  T{uc.tier}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug mb-2 line-clamp-2">{uc.description}</p>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: lvl.color }} />
                  {lvl.label}
                </span>
                <span>{uc.ruleType.replace('_', ' ')}</span>
                <span className="text-slate-600">{uc.actions.length} actions</span>
              </div>
              {uc.signal && (
                <div className="mt-2 rounded bg-slate-950/60 border border-slate-800 px-2 py-1 text-[9px] font-mono text-slate-400 truncate">
                  ⚡ {uc.signal}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─── utils ───────────────────────────────────────────────────────────────────
function chip(active: boolean): string {
  return `rounded-md border px-2 py-0.5 text-[10px] font-mono transition ${
    active ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700'
  }`
}

function statusColor(status: string): string {
  switch (status) {
    case 'pass': return '#22c55e'
    case 'fail': return '#ef4444'
    case 'skip': return '#64748b'
    case 'active': return '#fbbf24'
    case 'pending': return '#f59e0b'
    default: return '#64748b'
  }
}

const BRANCH_BG: Record<string, string> = {
  pass: 'rgba(16,185,129,0.15)', fail: 'rgba(239,68,68,0.15)', tier0: 'rgba(16,185,129,0.15)',
  tier1: 'rgba(245,158,11,0.15)', tier2: 'rgba(249,115,22,0.15)', tier3: 'rgba(239,68,68,0.15)',
  approve: 'rgba(16,185,129,0.15)', reject: 'rgba(239,68,68,0.15)', retry: 'rgba(245,158,11,0.15)',
  suppressed: 'rgba(100,116,139,0.15)', resolve: 'rgba(16,185,129,0.15)', compensate: 'rgba(239,68,68,0.15)',
}
const BRANCH_FG: Record<string, string> = {
  pass: '#34d399', fail: '#f87171', tier0: '#34d399', tier1: '#fbbf24', tier2: '#fb923c', tier3: '#f87171',
  approve: '#34d399', reject: '#f87171', retry: '#fbbf24', suppressed: '#94a3b8', resolve: '#34d399', compensate: '#f87171',
}
