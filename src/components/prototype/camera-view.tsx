'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Camera as CameraIcon, Loader2, AlertCircle, RefreshCw, Cpu, Sparkles } from 'lucide-react'
import { usePrototypeStore, CAMERA_SOURCES, type Detection } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { decide } from '@/lib/agent'
import { useAgentActions } from './use-agent-actions'
import { createSimulationState, nextSimulatedCount, syntheticBboxes } from '@/lib/simulation'
import type { RealMlHandle } from './real-ml-loader'

// Code-split TF.js + COCO-SSD into a separate chunk loaded only on demand.
// This keeps the default (simulation) bundle small and avoids dev-server OOM.
const RealMlLoader = dynamic(
  () => import('./real-ml-loader').then((m) => m.RealMlLoader),
  { ssr: false, loading: () => null }
)

type Mode = 'real' | 'simulation'

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const realMlHandleRef = useRef<RealMlHandle | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastDetectRef = useRef<number>(0)
  const lastFpsTickRef = useRef<{ t: number; n: number }>({ t: Date.now(), n: 0 })
  const simStateRef = useRef(createSimulationState())

  const [snapshotView, setSnapshotView] = useState<string | null>(null)

  // Store
  const activeCameraId = usePrototypeStore((s) => s.activeCameraId)
  const modelStatus = usePrototypeStore((s) => s.modelStatus)
  const isRunning = usePrototypeStore((s) => s.isRunning)
  const fps = usePrototypeStore((s) => s.fps)
  const lastDetectionLatencyMs = usePrototypeStore((s) => s.lastDetectionLatencyMs)
  const personCount = usePrototypeStore((s) => s.personCount)
  const stats = usePrototypeStore((s) => s.stats)
  const currentTier = usePrototypeStore((s) => s.currentTier)
  const detectionMode = usePrototypeStore((s) => s.detectionMode)

  const setActiveCamera = usePrototypeStore((s) => s.setActiveCamera)
  const setModelStatus = usePrototypeStore((s) => s.setModelStatus)
  const setRunning = usePrototypeStore((s) => s.setRunning)
  const setFps = usePrototypeStore((s) => s.setFps)
  const setLatency = usePrototypeStore((s) => s.setLatency)
  const pushDetections = usePrototypeStore((s) => s.pushDetections)
  const pushSimulatedCount = usePrototypeStore((s) => s.pushSimulatedCount)
  const clearSamples = usePrototypeStore((s) => s.clearSamples)
  const setDetectionMode = usePrototypeStore((s) => s.setDetectionMode)
  const setAgentState = usePrototypeStore((s) => s.setAgentState)
  const pushTrace = usePrototypeStore((s) => s.pushTrace)
  const pushHit = usePrototypeStore((s) => s.pushHit)

  const agentActions = useAgentActions()

  const activeCamera = CAMERA_SOURCES.find((c) => c.id === activeCameraId) ?? CAMERA_SOURCES[0]

  // ===== Agent loop (shared by both modes) =====
  const runAgentLoop = (canvas: HTMLCanvasElement | null, dets: Detection[]) => {
    const state = usePrototypeStore.getState()
    if (!state.stats) return
    const decision = decide(
      {
        stats: state.stats,
        cameraId: activeCamera.id,
        cameraLabel: activeCamera.label,
        sustainCount: state.sustainCount,
        escalationHistory: state.escalationHistory,
        acknowledgedUntil: state.acknowledgedUntil,
        llmJudgeEnabled: state.llmJudgeEnabled,
      },
      state.agentConfig
    )
    setAgentState({
      sustainCount: state.sustainCount,
      currentTier: decision.tier,
      agentReasoning: decision.reasoning,
      agentCycleCount: state.agentCycleCount + 1,
    })
    pushTrace(decision.reasoning)

    Promise.all(
      decision.actions.map((action) =>
        agentActions.execute(action, {
          cameraId: activeCamera.id,
          cameraLabel: activeCamera.label,
          stats: state.stats!,
          detections: dets,
          reasoning: decision.reasoning,
          canvas: canvas ?? ({} as HTMLCanvasElement),
        })
      )
    ).catch((err) => console.error('[agent] action error:', err))

    if (decision.tier >= 2 && canvas && typeof canvas.toDataURL === 'function') {
      try {
        const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.7)
        pushHit({
          id: `hit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          tier: decision.tier,
          cameraId: activeCamera.id,
          cameraLabel: activeCamera.label,
          count: state.stats.count,
          zScore: state.stats.peakZ,
          mean: state.stats.mean,
          stddev: state.stats.stddev,
          reasoning: decision.reasoning,
          snapshotDataUrl,
          acknowledged: false,
        })
        if (decision.tier === 3) {
          setAgentState({
            escalationHistory: [...state.escalationHistory, Date.now()],
          })
        }
      } catch (err) {
        console.error('[CameraView] snapshot failed:', err)
      }
    }
  }

  // Reset simulation state on mode/camera switch
  useEffect(() => {
    simStateRef.current = createSimulationState()
  }, [detectionMode, activeCameraId])

  // ===== Real ML detection loop =====
  useEffect(() => {
    if (detectionMode !== 'real' || !isRunning) return
    let cancelled = false

    const loop = async () => {
      if (cancelled) return
      const canvas = canvasRef.current
      const handle = realMlHandleRef.current
      if (!canvas || !handle) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const now = Date.now()
      if (now - lastDetectRef.current < 1500) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      lastDetectRef.current = now

      try {
        const result = await handle.detect()
        if (!result) {
          rafRef.current = requestAnimationFrame(loop)
          return
        }
        const { dets, latency } = result
        pushDetections(dets)
        setLatency(latency)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          drawBoxes(ctx, canvas, dets)
        }

        const fpsTick = lastFpsTickRef.current
        fpsTick.n += 1
        if (now - fpsTick.t > 1000) {
          setFps(Math.round((fpsTick.n * 1000) / (now - fpsTick.t)))
          fpsTick.t = now
          fpsTick.n = 0
        }

        runAgentLoop(canvas, dets)
      } catch (err) {
        console.error('[CameraView] detect error:', err)
        pushTrace(`detect error: ${err instanceof Error ? err.message : 'unknown'}`)
      }

      if (!cancelled) rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [detectionMode, isRunning, pushDetections, setLatency, setFps, pushTrace])

  // ===== Simulation loop =====
  useEffect(() => {
    if (detectionMode !== 'simulation' || !isRunning) return
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const now = Date.now()
      if (now - lastDetectRef.current >= 1000) {
        lastDetectRef.current = now

        const canvas = canvasRef.current
        const video = videoRef.current
        const cw = canvas?.width ?? 480
        const ch = canvas?.height ?? 270

        const t0 = performance.now()
        const count = nextSimulatedCount(simStateRef.current)
        const latency = performance.now() - t0

        const synthDets: Detection[] = syntheticBboxes(count, cw, ch)
        pushSimulatedCount(count)
        setLatency(latency)
        setFps(1)

        if (canvas && video && video.readyState >= 2) {
          const targetW = 480
          const targetH = Math.round((video.videoHeight / video.videoWidth) * targetW)
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW
            canvas.height = targetH
          }
          const ctx = canvas.getContext('2d')
          if (ctx) drawBoxes(ctx, canvas, synthDets, video)
        }

        runAgentLoop(canvas, synthDets)
      }
      if (!cancelled) setTimeout(tick, 200)
    }

    tick()
    return () => {
      cancelled = true
    }
  }, [detectionMode, isRunning, pushSimulatedCount, setLatency, setFps])

  // ===== Continuous box redraw (simulation mode, between ticks) =====
  useEffect(() => {
    if (detectionMode !== 'simulation' || !isRunning) return
    let raf: number
    const draw = () => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (canvas && video && video.readyState >= 2) {
        const targetW = 480
        const targetH = Math.round((video.videoHeight / video.videoWidth) * targetW)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const state = usePrototypeStore.getState()
          const dets = syntheticBboxes(state.personCount, canvas.width, canvas.height)
          drawBoxes(ctx, canvas, dets, video)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [detectionMode, isRunning])

  // Pause/play video
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isRunning) {
      v.play().catch((err) => console.error('[video] play failed:', err))
    } else {
      v.pause()
    }
  }, [isRunning, activeCameraId, detectionMode])

  const handleSnapshot = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/jpeg', 0.85)
    setSnapshotView(url)
  }

  const handleModeSwitch = (mode: Mode) => {
    if (mode === detectionMode) return
    setRunning(false)
    clearSamples()
    setDetectionMode(mode)
    if (mode === 'simulation') {
      setModelStatus('ready')
    }
    pushTrace(`Mode switched → ${mode === 'real' ? 'real ML (COCO-SSD)' : 'simulation'}`)
  }

  const tierColor = currentTier === 3 ? 'bg-rose-600' : currentTier === 2 ? 'bg-amber-500' : currentTier === 1 ? 'bg-amber-400' : 'bg-emerald-500'
  const tierLabel = currentTier === 3 ? 'CRITICAL' : currentTier === 2 ? 'ANOMALY' : currentTier === 1 ? 'WATCH' : 'NOMINAL'

  const canStart = detectionMode === 'simulation' || modelStatus === 'ready'

  return (
    <div className="space-y-3">
      {/* Code-split Real ML loader — only loaded in Real ML mode */}
      {detectionMode === 'real' && (
        <RealMlLoader
          videoRef={videoRef}
          canvasRef={canvasRef}
          onModelStatus={(s, err = null) => setModelStatus(s, err)}
          onModelReady={(handle) => {
            realMlHandleRef.current = handle
          }}
        />
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={activeCameraId} onValueChange={(v) => { setActiveCamera(v); clearSamples() }}>
          <SelectTrigger className="w-[260px] h-9 bg-white">
            <SelectValue placeholder="Select camera" />
          </SelectTrigger>
          <SelectContent>
            {CAMERA_SOURCES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-medium">{c.label}</span>
                <span className="text-xs text-zinc-500 ml-2">· {c.location}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-0.5">
          <button
            onClick={() => handleModeSwitch('real')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              detectionMode === 'real' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Run actual COCO-SSD model on video frames (best with GPU)"
          >
            <Cpu className="h-3 w-3" />
            Real ML
          </button>
          <button
            onClick={() => handleModeSwitch('simulation')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              detectionMode === 'simulation' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Synthetic person counts (with realistic crowd surges) — same agent pipeline"
          >
            <Sparkles className="h-3 w-3" />
            Simulation
          </button>
        </div>

        <Button
          onClick={() => setRunning(!isRunning)}
          disabled={!canStart}
          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          {isRunning ? <Pause className="h-4 w-4 mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
          {isRunning ? 'Pause' : 'Start analysis'}
        </Button>

        <Button onClick={handleSnapshot} variant="outline" size="sm" className="h-9" disabled={!isRunning}>
          <CameraIcon className="h-4 w-4 mr-1.5" />
          Snapshot
        </Button>

        <Button onClick={() => { clearSamples() }} variant="outline" size="sm" className="h-9">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reset baseline
        </Button>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          {detectionMode === 'real' && modelStatus === 'loading' && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading model...
            </span>
          )}
          {detectionMode === 'real' && modelStatus === 'ready' && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono">COCO-SSD ready</span>
            </span>
          )}
          {detectionMode === 'real' && modelStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-rose-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Model load failed</span>
            </span>
          )}
          {detectionMode === 'simulation' && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono">Simulation · 1 Hz</span>
            </span>
          )}
          {isRunning && (
            <>
              <span className="font-mono">FPS: <span className="text-zinc-950">{fps}</span></span>
              <span className="font-mono">Latency: <span className="text-zinc-950">{lastDetectionLatencyMs.toFixed(0)}ms</span></span>
            </>
          )}
        </div>
      </div>

      {/* Video + canvas overlay */}
      <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-black aspect-video">
        <video
          ref={videoRef}
          src={activeCamera.src}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted
          playsInline
          crossOrigin="anonymous"
          preload="auto"
          onLoadedData={() => {
            if (isRunning) videoRef.current?.play().catch(() => {})
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Overlay UI — camera label + tier badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'}`} />
            {activeCamera.label}
          </div>
          {detectionMode === 'simulation' && (
            <div className="bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md font-mono uppercase tracking-wide">
              Sim
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3">
          <div className={`text-white text-xs px-2.5 py-1 rounded-md font-mono font-semibold flex items-center gap-1.5 ${tierColor}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            Tier {currentTier} · {tierLabel}
          </div>
        </div>

        {/* Person count overlay */}
        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-md">
          <div className="text-[10px] uppercase tracking-wide text-white/60">Persons now</div>
          <div className="font-mono text-2xl font-medium tabular-nums leading-none">{personCount}</div>
        </div>
        {stats && (
          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-right">
            <div className="text-[10px] uppercase tracking-wide text-white/60">z-score</div>
            <div className="font-mono text-xl font-medium tabular-nums leading-none">
              {stats.peakZ.toFixed(2)}
            </div>
          </div>
        )}

        {/* Paused / loading overlay */}
        {!isRunning && canStart && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="bg-white/95 px-4 py-2 rounded-lg text-sm font-medium text-zinc-950">
              Press &ldquo;Start analysis&rdquo; to begin
            </div>
          </div>
        )}
        {detectionMode === 'real' && modelStatus === 'loading' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="bg-white/95 px-4 py-3 rounded-lg text-sm text-zinc-950 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading COCO-SSD model (~5s)...
            </div>
          </div>
        )}
        {detectionMode === 'real' && modelStatus === 'error' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6">
            <div className="bg-white/95 px-4 py-3 rounded-lg text-sm text-rose-700 max-w-md">
              <div className="font-semibold mb-1">Model failed to load</div>
              <div className="text-xs text-zinc-600 mb-2">
                The COCO-SSD model could not be loaded. Switch to <strong>Simulation</strong> mode to continue the demo, or refresh to retry.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot preview */}
      {snapshotView && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-700">Manual snapshot</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSnapshotView(null)}>
              Close
            </Button>
          </div>
          <img src={snapshotView} alt="snapshot" className="rounded-lg max-h-72 mx-auto" />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Helpers
   ============================================================ */

function drawBoxes(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dets: Detection[],
  video?: HTMLVideoElement
) {
  // Re-draw the current video frame to clear previous boxes
  if (video && video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const persons = dets.filter((d) => d.class === 'person')
  for (const det of persons) {
    const [x, y, w, h] = det.bbox
    const color = '#10b981'
    ctx.lineWidth = 2
    ctx.strokeStyle = color
    ctx.strokeRect(x, y, w, h)
    const label = `${det.class} ${(det.score * 100).toFixed(0)}%`
    ctx.font = '11px ui-monospace, monospace'
    const tw = ctx.measureText(label).width + 8
    ctx.fillStyle = color
    ctx.fillRect(x, Math.max(0, y - 16), tw, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + 4, Math.max(11, y - 4))
  }
}
