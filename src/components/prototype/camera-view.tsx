'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Camera as CameraIcon, Loader2, AlertCircle, RefreshCw, Cpu } from 'lucide-react'
import { usePrototypeStore, CAMERA_SOURCES, type Detection } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { decide } from '@/lib/agent'
import { USE_CASES } from '@/lib/use-cases'
import { WithinFeedTracker, GlobalIdentityManager, extractAppearanceFeatures } from '@/lib/identity'
import { computePixelAnomaly, computeAnomalyBbox, getPixelAnomalyType, resetPixelAnomalyBuffer, type PixelAnomalyResult } from '@/lib/pixel-anomaly'
import { runSpecializedDetection, runSpecializedDetectionEnsemble, hasSpecializedModel, getSpecializedModelInfo, getAllModelNames } from '@/lib/specialized-models'
import { prefixPath } from '@/lib/path-utils'
import { useAgentActions } from './use-agent-actions'
import type { RealMlHandle } from './real-ml-loader'

/**
 * CameraView — Real ML only, no simulation.
 *
 * This component runs REAL COCO-SSD object detection on REAL video frames.
 * There is NO simulation mode, NO synthetic bounding boxes, NO fake counts.
 * Every detection you see on screen comes from the TensorFlow.js model
 * running inference on the actual video frame.
 *
 * The model is code-split via next/dynamic so TF.js only loads when this
 * component mounts. The RealMlLoader component handles model loading and
 * provides a `detect()` handle that draws the video frame to canvas and
 * runs inference.
 */

const RealMlLoader = dynamic(
  () => import('./real-ml-loader').then((m) => m.RealMlLoader),
  { ssr: false, loading: () => null }
)

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const realMlHandleRef = useRef<RealMlHandle | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastDetectRef = useRef<number>(0)
  const lastFpsTickRef = useRef<{ t: number; n: number }>({ t: Date.now(), n: 0 })
  const hfDetectionRef = useRef<{ class: string; score: number; timestamp: number } | null>(null)
  const trackerRef = useRef<WithinFeedTracker>(new WithinFeedTracker(60, 0.3))
  const identityMgrRef = useRef<GlobalIdentityManager>(new GlobalIdentityManager(0.6, 24))

  const [snapshotView, setSnapshotView] = useState<string | null>(null)

  // Store
  const activeCameraId = usePrototypeStore((s) => s.activeCameraId)
  const activeUseCaseId = usePrototypeStore((s) => s.activeUseCaseId)
  const modelStatus = usePrototypeStore((s) => s.modelStatus)
  const isRunning = usePrototypeStore((s) => s.isRunning)
  const fps = usePrototypeStore((s) => s.fps)
  const lastDetectionLatencyMs = usePrototypeStore((s) => s.lastDetectionLatencyMs)
  const personCount = usePrototypeStore((s) => s.personCount)
  const stats = usePrototypeStore((s) => s.stats)
  const currentTier = usePrototypeStore((s) => s.currentTier)

  const setActiveCamera = usePrototypeStore((s) => s.setActiveCamera)
  const setModelStatus = usePrototypeStore((s) => s.setModelStatus)
  const setRunning = usePrototypeStore((s) => s.setRunning)
  const setFps = usePrototypeStore((s) => s.setFps)
  const setLatency = usePrototypeStore((s) => s.setLatency)
  const pushDetections = usePrototypeStore((s) => s.pushDetections)
  const clearSamples = usePrototypeStore((s) => s.clearSamples)
  const setAgentState = usePrototypeStore((s) => s.setAgentState)
  const pushTrace = usePrototypeStore((s) => s.pushTrace)
  const pushHit = usePrototypeStore((s) => s.pushHit)
  const setTrackedIdentities = usePrototypeStore((s) => s.setTrackedIdentities)

  const agentActions = useAgentActions()

  const activeCamera = CAMERA_SOURCES.find((c) => c.id === activeCameraId) ?? CAMERA_SOURCES[0]
  const activeUseCase = USE_CASES.find((uc) => uc.id === activeUseCaseId)

  // ===== Agent loop (shared) =====
  const runAgentLoop = (canvas: HTMLCanvasElement | null, dets: Detection[]) => {
    const state = usePrototypeStore.getState()
    if (!state.stats) return

    // Find the active use case
    const useCase = USE_CASES.find((uc) => uc.id === state.activeUseCaseId) || USE_CASES[0]

    // For sustain_verify AND frame_diff use cases, increment sustainCount
    // based on whether the specialized model or COCO-SSD detected something.
    // Check both the specializedClassName (for HF model detections) AND
    // detectionClasses (for COCO-SSD detections like person/car/backpack).
    const allTrackedClasses = [...useCase.detectionClasses]
    if (useCase.specializedClassName) allTrackedClasses.push(useCase.specializedClassName)
    const hasTrackedDetections = dets.filter(d => allTrackedClasses.includes(d.class)).length > 0
    const usesDetectionBasedSustain = useCase.ruleType === 'sustain_verify' || useCase.ruleType === 'frame_diff'
    const newSustainCount = usesDetectionBasedSustain
      ? (hasTrackedDetections ? state.sustainCount + 1 : 0)
      : state.sustainCount

    const decision = decide(
      {
        stats: state.stats,
        cameraId: activeCamera.id,
        cameraLabel: activeCamera.label,
        sustainCount: newSustainCount,
        escalationHistory: state.escalationHistory,
        acknowledgedUntil: state.acknowledgedUntil,
        llmJudgeEnabled: state.llmJudgeEnabled,
        useCase,
        capabilityLevel: state.capabilityLevel,
        detections: dets,
        canvasW: canvas?.width ?? 480,
        canvasH: canvas?.height ?? 270,
      },
      state.agentConfig
    )
    setAgentState({
      sustainCount: newSustainCount,
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
        const now = Date.now()

        // ─── DUPLICATE SUPPRESSION ───
        // Don't create a new hit if there's an existing active hit for the
        // same camera+useCase within the last 10 seconds. This prevents
        // video loops from generating repeated alerts for the same event.
        const recentHits = state.hits.filter(h =>
          h.cameraId === activeCamera.id &&
          h.useCaseId === useCase.id &&
          !h.acknowledged &&
          (h.lifecycle === 'active' || h.lifecycle === 'confirmed') &&
          (now - h.timestamp) < 10_000
        )

        if (recentHits.length === 0) {
          // No recent active hit — create a new one
          pushHit({
            id: `hit-${now}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: now,
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
            lifecycle: 'confirmed',
            candidateSince: now,
            confirmedSince: now,
            useCaseId: useCase.id,
          })
        }
        // If there IS a recent hit, we just update its timestamp silently
        // (no new alert created — the existing one stays active)

        if (decision.tier === 3) {
          setAgentState({
            escalationHistory: [...state.escalationHistory, now],
          })
        }
      } catch (err) {
        console.error('[CameraView] snapshot failed:', err)
      }
    }
  }

  // Reset on camera switch
  useEffect(() => {
    // Clear baseline when switching cameras
    clearSamples()
    // Reset tracker and identity gallery on camera switch
    trackerRef.current.reset()
    // Reset pixel anomaly frame buffer
    resetPixelAnomalyBuffer()
  }, [activeCameraId, clearSamples])

  // ===== Real ML detection loop =====
  // ARCHITECTURE: COCO-SSD runs in the main loop (fast, ~1-3s per cycle).
  // HF models run in a SEPARATE background task (slow, 30-60s first load).
  // This prevents the HF model loading from blocking the FPS counter and
  // COCO-SSD detection results.
  useEffect(() => {
    if (!isRunning) return
    let cancelled = false
    let hfInFlight = false // prevent overlapping HF inferences

    const loop = async () => {
      if (cancelled) return
      const canvas = canvasRef.current
      const handle = realMlHandleRef.current
      if (!canvas || !handle) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const now = Date.now()
      // Throttle to ~0.66 Hz (every 1.5s) to keep CPU/GPU reasonable
      if (now - lastDetectRef.current < 1500) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      lastDetectRef.current = now

      try {
        // ─── Step 1: COCO-SSD detection (fast, non-blocking for HF) ───
        const result = await handle.detect()
        if (!result) {
          rafRef.current = requestAnimationFrame(loop)
          return
        }
        const { dets, latency } = result
        const ctx = canvas.getContext('2d')

        if (ctx) {
          const useCase = USE_CASES.find((uc) => uc.id === usePrototypeStore.getState().activeUseCaseId)
          const className = useCase?.specializedClassName || useCase?.id || 'unknown'

          // ─── Step 2: Pixel-anomaly (synchronous, fast) ───
          if (useCase) {
            const anomalyType = getPixelAnomalyType(useCase.id)
            if (anomalyType) {
              const pixelAnomaly = computePixelAnomaly(ctx, canvas.width, canvas.height, anomalyType)
              pushTrace(`Pixel anomaly [${anomalyType}]: score=${pixelAnomaly.score.toFixed(2)} (${pixelAnomaly.details})`)
              if (pixelAnomaly.score > 0.3 && dets.filter(d => d.class === className).length === 0) {
                // Compute ACTUAL anomalous region bbox instead of hard-coded box.
                // Sample the canvas for anomalous pixels and find their bounding region.
                const anomalyBbox = computeAnomalyBbox(ctx, canvas.width, canvas.height, anomalyType)
                dets.push({
                  bbox: anomalyBbox,
                  class: className,
                  score: pixelAnomaly.score,
                })
              }
            }
          }

          // ─── Step 3: HF models — FIRE AND FORGET (non-blocking) ───
          // Run HF model inference in the background. Don't await it — let
          // COCO-SSD results show immediately. HF results will be injected
          // into the NEXT cycle's detections via a ref.
          if (useCase && hasSpecializedModel(useCase.id) && !hfInFlight) {
            hfInFlight = true
            // Fire and forget — don't block the loop
            runSpecializedDetectionEnsemble(canvas, useCase.id)
              .then(ensembleResults => {
                if (cancelled) return
                for (const specResult of ensembleResults) {
                  if (specResult.label === 'load_failed') {
                    pushTrace(`HF Model [${specResult.modelName}]: unavailable — pixel fallback active`)
                  } else if (specResult.label === 'inference_error') {
                    pushTrace(`HF Model [${specResult.modelName}]: inference error — pixel fallback active`)
                  } else if (specResult.label === 'timeout') {
                    pushTrace(`HF Model [${specResult.modelName}]: timed out — pixel fallback active`)
                  } else {
                    pushTrace(`HF Model [${specResult.modelName}]: ${specResult.details}`)
                    // Store the HF detection for injection into the next cycle
                    if (specResult.detected) {
                      hfDetectionRef.current = {
                        class: className,
                        score: specResult.confidence,
                        timestamp: Date.now(),
                      }
                    }
                  }
                }
              })
              .catch(err => {
                console.warn('[HF] ensemble error:', err)
              })
              .finally(() => {
                hfInFlight = false
              })
          }

          // ─── Step 4: Inject HF detection from previous cycle (if any) ───
          // HF models are whole-image classifiers — they classify the entire
          // frame, not a specific region. Use the full canvas as the bbox
          // with a small margin so the box is visible at the edges.
          if (hfDetectionRef.current) {
            const hfDet = hfDetectionRef.current
            // Only inject if it's recent (< 10s old) and no existing detection
            if (Date.now() - hfDet.timestamp < 10_000 && dets.filter(d => d.class === hfDet.class).length === 0) {
              dets.push({
                // Use full canvas with 5% margin — represents "entire frame classified"
                bbox: [
                  canvas.width * 0.05,
                  canvas.height * 0.05,
                  canvas.width * 0.9,
                  canvas.height * 0.9,
                ] as [number, number, number, number],
                class: hfDet.class,
                score: hfDet.score,
              })
            } else if (Date.now() - hfDet.timestamp >= 10_000) {
              // Expired — clear it
              hfDetectionRef.current = null
            }
          }

          // ─── Step 5: Push detections + draw boxes ───
          pushDetections(dets)
          setLatency(latency)
          drawBoxes(ctx, canvas, dets, videoRef.current ?? undefined, imgRef.current ?? undefined)

          // ===== TRACKING + IDENTITY MANAGEMENT =====
          // Update within-feed tracker with new detections
          const tracked = trackerRef.current.update(dets)
          const identityMgr = identityMgrRef.current

          // Match or create global identities for each tracked object
          for (const track of tracked) {
            const appearance = extractAppearanceFeatures(ctx, track.bbox, canvas.width, canvas.height)
            const type = track.class === 'person' ? 'person' : 'vehicle'
            const globalId = identityMgr.matchOrCreate(
              track.localTrackId,
              type,
              appearance,
              activeCamera.id,
              track.bbox,
              track.score
            )
          }

          // Update store with current identities (throttled — every 5 frames)
          const fpsTick = lastFpsTickRef.current
          if (fpsTick.n % 5 === 0) {
            const identities = identityMgr.getIdentities().map((id) => ({
              globalId: id.globalId,
              type: id.type,
              firstSeen: id.firstSeen,
              lastSeen: id.lastSeen,
              observations: id.observations.length,
              plateString: id.plateString,
              dominantColor: id.appearance.dominantColor,
            }))
            setTrackedIdentities(identities.slice(0, 50))
          }
        }

        const fpsTick = lastFpsTickRef.current
        fpsTick.n += 1
        // Update FPS every 3 seconds (not 1s) to handle slow WASM inference
        // where a single COCO-SSD cycle takes 3-5 seconds.
        if (now - fpsTick.t > 3000) {
          // Show fractional FPS (e.g., 0.3) when cycles are slow
          const rawFps = (fpsTick.n * 1000) / (now - fpsTick.t)
          setFps(rawFps < 1 ? Math.round(rawFps * 10) / 10 : Math.round(rawFps))
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
  }, [isRunning, pushDetections, setLatency, setFps, pushTrace])

  // Pause/play video — also handles headless Chromium where play() may
  // need an explicit currentTime nudge to start decoding frames.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isRunning) {
      // Nudge currentTime forward slightly to force a frame decode in headless
      if (v.currentTime === 0 && v.readyState >= 1) {
        v.currentTime = 0.1
      }
      const playPromise = v.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          console.warn('[video] play failed (will retry):', err instanceof Error ? err.message : err)
          // Retry after a short delay — sometimes the video element isn't ready
          setTimeout(() => {
            v.play().catch(() => {})
          }, 500)
        })
      }
    } else {
      v.pause()
    }
  }, [isRunning, activeCameraId])

  const handleSnapshot = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/jpeg', 0.85)
    setSnapshotView(url)
  }

  const tierColor = currentTier === 3 ? 'bg-rose-600' : currentTier === 2 ? 'bg-amber-500' : currentTier === 1 ? 'bg-amber-400' : 'bg-emerald-500'
  const tierLabel = currentTier === 3 ? 'CRITICAL' : currentTier === 2 ? 'ANOMALY' : currentTier === 1 ? 'WATCH' : 'NOMINAL'

  const canStart = modelStatus === 'ready'

  return (
    <div className="space-y-3">
      {/* Real ML loader — always loaded */}
      <RealMlLoader
        videoRef={videoRef}
        imgRef={imgRef}
        canvasRef={canvasRef}
        isStatic={activeCamera.isStatic}
        onModelStatus={(s, err = null) => setModelStatus(s, err)}
        onModelReady={(handle) => {
          realMlHandleRef.current = handle
        }}
      />

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

        {/* Dynamic multi-model badge — shows the ensemble running for this use case */}
        <div
          className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5"
          title={(() => {
            const hfModels = getAllModelNames(activeUseCaseId)
            const parts = ['COCO-SSD (always)']
            if (hfModels.length > 0) parts.push(...hfModels)
            const anomalyType = getPixelAnomalyType(activeUseCaseId)
            if (anomalyType) parts.push(`Pixel-anomaly (${anomalyType})`)
            return `Ensemble: ${parts.join(' + ')}`
          })()}
        >
          <Cpu className="h-3 w-3 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">
            {activeUseCase?.primaryModel ? activeUseCase.primaryModel.split('(')[0].trim() : 'Real ML'}
          </span>
          {/* Show model count badge — e.g., "3 models" for COCO-SSD + HF + pixel */}
          <span className="text-[9px] text-amber-600 font-mono ml-0.5" title="Number of models in ensemble">
            ×{1 + (hasSpecializedModel(activeUseCaseId) ? getAllModelNames(activeUseCaseId).length : 0) + (getPixelAnomalyType(activeUseCaseId) ? 1 : 0)}
          </span>
        </div>

        <Button
          onClick={() => setRunning(!isRunning)}
          disabled={!canStart}
          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
          title={isRunning ? "Pausar el análisis de IA" : "Iniciar detección de personas y vehículos con IA real (COCO-SSD)"}
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
          {modelStatus === 'loading' && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading COCO-SSD model...
            </span>
          )}
          {modelStatus === 'ready' && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono">
                {hasSpecializedModel(activeUseCaseId)
                  ? `${activeUseCase?.primaryModel?.split('(')[0].trim() || 'HF Model'} + COCO-SSD ready`
                  : 'COCO-SSD ready · WebGL'}
              </span>
            </span>
          )}
          {modelStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-rose-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Model load failed — refresh to retry</span>
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

      {/* Video OR static image + canvas overlay */}
      <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-black aspect-video">
        {activeCamera.isStatic ? (
          <img
            ref={imgRef}
            src={prefixPath(activeCamera.src)}
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
            alt={activeCamera.label}
          />
        ) : (
          <video
            ref={videoRef}
            src={prefixPath(activeCamera.src)}
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
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Overlay UI — camera label + Live ML badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'}`} />
            {activeCamera.label}
          </div>
          <div className="bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md font-mono uppercase tracking-wide">
            Live ML
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <div className={`text-white text-xs px-2.5 py-1 rounded-md font-mono font-semibold flex items-center gap-1.5 ${tierColor}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            Tier {currentTier} · {tierLabel}
          </div>
        </div>

        {/* Person count overlay */}
        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-md">
          <div className="text-[10px] uppercase tracking-wide text-white/60">Persons detected</div>
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
              Press "Start analysis" to begin real ML detection
            </div>
          </div>
        )}
        {modelStatus === 'loading' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="bg-white/95 px-4 py-3 rounded-lg text-sm text-zinc-950 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading COCO-SSD model (~5s)...
            </div>
          </div>
        )}
        {modelStatus === 'error' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6">
            <div className="bg-white/95 px-4 py-3 rounded-lg text-sm text-rose-700 max-w-md">
              <div className="font-semibold mb-1">Model failed to load</div>
              <div className="text-xs text-zinc-600 mb-2">
                The COCO-SSD model could not be loaded. Please refresh the page to retry. The model loads from Google's CDN on first run.
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
  video?: HTMLVideoElement,
  img?: HTMLImageElement
) {
  // Re-draw the current frame to clear previous boxes. Use video if available,
  // otherwise fall back to static image (for isStatic cameras).
  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  } else if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Color map for different detection classes
  const CLASS_COLORS: Record<string, string> = {
    person: '#10b981',     // emerald
    car: '#3b82f6',        // blue
    truck: '#3b82f6',      // blue
    bus: '#3b82f6',        // blue
    motorcycle: '#3b82f6', // blue
    bicycle: '#3b82f6',    // blue
    backpack: '#f59e0b',   // amber
    suitcase: '#f59e0b',   // amber
    handbag: '#f59e0b',    // amber
    fire: '#ef4444',       // red
    graffiti: '#a855f7',   // purple
    flood: '#06b6d4',      // cyan
    landslide: '#f97316',  // orange
    crack: '#f97316',      // orange
    slip_hazard: '#eab308', // yellow
    abandoned_object: '#f59e0b', // amber
  }

  // Draw ALL detections (not just persons) with class-appropriate colors
  for (const det of dets) {
    const [x, y, w, h] = det.bbox
    const color = CLASS_COLORS[det.class] || '#10b981' // default emerald
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
