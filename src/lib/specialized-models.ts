/**
 * Multi-Model Ensemble Framework for Vision Agent
 *
 * ─── Architecture (v4 — 2026-07-22) ──────────────────────────────────────
 *
 * Every use case runs MULTIPLE models simultaneously (MoE-style ensemble):
 *
 * 1. **COCO-SSD** (always runs) — detects persons, cars, backpacks, etc.
 *    Provides bounding-box detections for COCO classes.
 *
 * 2. **Specialized HF models** (1-2 per use case) — run in parallel:
 *    - Dedicated ONNX classifiers (fire detection ViT)
 *    - CLIP zero-shot classification (graffiti, flood, landslide, crack, slip)
 *    - Each produces a classification result (label + confidence)
 *
 * 3. **Pixel-anomaly** (always available as fallback) — HSV color analysis,
 *    frame-differencing, edge density. Runs when HF models are unavailable.
 *
 * **Ensemble merging**: Detections from all models are merged. If ANY model
 * detects the target event, a synthetic detection is injected with the
 * specializedClassName. The agent loop sees ALL detections and can reason
 * about multi-model agreement (e.g., "COCO-SSD detected a person AND the
 * fire model detected fire → high-confidence incident").
 *
 * ELI5: "We don't rely on just one AI model. For every camera, we run
 * several models at the same time — like having multiple security guards
 * each looking for different things. If any of them spots something, we
 * alert. If multiple spot the same thing, we're even more confident."
 */

import type { PixelAnomalyResult } from './pixel-anomaly'

export interface SpecializedDetection {
  modelId: string
  modelName: string
  useCaseId: string
  detected: boolean
  confidence: number
  label: string
  details: string
  /** Which model layer produced this detection (for ensemble traceability) */
  source: 'dedicated' | 'clip-zero-shot' | 'pixel-anomaly'
}

// ─── Model config types ────────────────────────────────────────────────────
type ModelTask = 'image-classification' | 'zero-shot-image-classification'

interface BaseModelConfig {
  modelId: string
  modelName: string
  task: ModelTask
  /** Confidence threshold for triggering a detection */
  threshold: number
  /** Which ensemble layer this model belongs to */
  source: 'dedicated' | 'clip-zero-shot'
}

interface ImageClassificationConfig extends BaseModelConfig {
  task: 'image-classification'
  /** Substrings to match against model output labels (case-insensitive) */
  positiveLabels: string[]
}

interface ZeroShotConfig extends BaseModelConfig {
  task: 'zero-shot-image-classification'
  source: 'clip-zero-shot'
  /** Candidate labels to pass to CLIP — the model will score each one */
  candidateLabels: string[]
  /** Indices into candidateLabels that count as a "positive" detection */
  positiveIndices: number[]
}

type ModelConfig = ImageClassificationConfig | ZeroShotConfig

// ─── Multi-Model Registry ──────────────────────────────────────────────────
// Each use case maps to an ARRAY of model configs. All run in parallel.
// COCO-SSD always runs (handled separately in camera-view).
// Pixel-anomaly always runs as fallback (handled in camera-view).
const MODEL_REGISTRY: Record<string, ModelConfig[]> = {
  // ─── Fire: dedicated ViT + CLIP zero-shot (dual-model ensemble) ───
  fire_smoke: [
    {
      modelId: 'prithivMLmods/Fire-Detection-Engine-ONNX',
      modelName: 'Fire Detection Engine',
      task: 'image-classification',
      source: 'dedicated',
      positiveLabels: ['fire needed action', 'smoky'],
      threshold: 0.5,
    },
    {
      modelId: 'Xenova/clip-vit-base-patch32',
      modelName: 'Fire (CLIP zero-shot)',
      task: 'zero-shot-image-classification',
      source: 'clip-zero-shot',
      candidateLabels: [
        'a large fire with flames and smoke',
        'a smoky environment with fire hazard',
        'a normal scene with no fire',
        'a dark nighttime scene',
      ],
      positiveIndices: [0, 1],
      threshold: 0.15,
    },
  ],

  // ─── Graffiti: CLIP zero-shot (no dedicated ONNX exists) ───
  graffiti: [
    {
      modelId: 'Xenova/clip-vit-base-patch32',
      modelName: 'Graffiti/Vandalism (CLIP zero-shot)',
      task: 'zero-shot-image-classification',
      source: 'clip-zero-shot',
      candidateLabels: [
        'graffiti spray painted on a wall',
        'vandalism and property damage',
        'a clean undamaged wall',
        'a normal street scene',
      ],
      positiveIndices: [0, 1],
      threshold: 0.15,
    },
  ],

  // ─── Flood: CLIP zero-shot ───
  flood_watch: [
    {
      modelId: 'Xenova/clip-vit-base-patch32',
      modelName: 'Flood Detection (CLIP zero-shot)',
      task: 'zero-shot-image-classification',
      source: 'clip-zero-shot',
      candidateLabels: [
        'a flooded street submerged in water',
        'a flooded area with rising water',
        'a dry normal street',
        'a normal dry landscape',
      ],
      positiveIndices: [0, 1],
      threshold: 0.20,
    },
  ],

  // ─── Landslide: CLIP zero-shot ───
  landslide_watch: [
    {
      modelId: 'Xenova/clip-vit-base-patch32',
      modelName: 'Landslide Detection (CLIP zero-shot)',
      task: 'zero-shot-image-classification',
      source: 'clip-zero-shot',
      candidateLabels: [
        'a landslide with mud and debris flow',
        'a slope failure with exposed earth',
        'stable vegetated terrain',
        'a normal intact hillside',
      ],
      positiveIndices: [0, 1],
      threshold: 0.15,
    },
  ],

  // ─── Crack (post-quake): CLIP zero-shot ───
  post_quake: [
    {
      modelId: 'Xenova/clip-vit-base-patch32',
      modelName: 'Crack Detection (CLIP zero-shot)',
      task: 'zero-shot-image-classification',
      source: 'clip-zero-shot',
      candidateLabels: [
        'a wall with deep structural cracks',
        'concrete with cracks and spalling damage',
        'a smooth intact concrete surface',
        'an undamaged wall',
      ],
      positiveIndices: [0, 1],
      threshold: 0.20,
    },
  ],

  // ─── Slip/fall hazard: CLIP zero-shot ───
  slip_hazard: [
    {
      modelId: 'Xenova/clip-vit-base-patch32',
      modelName: 'Slip Hazard (CLIP zero-shot)',
      task: 'zero-shot-image-classification',
      source: 'clip-zero-shot',
      candidateLabels: [
        'a person falling down',
        'a person slipping on a wet floor',
        'a wet slippery floor surface',
        'a person standing normally',
        'a dry safe floor',
      ],
      positiveIndices: [0, 1, 2],
      threshold: 0.20,
    },
  ],
}

// Cache loaded pipeline functions — keyed by modelId (so CLIP is loaded once,
// shared by all zero-shot use cases).
const pipelineCache: Map<string, any> = new Map()

// Track models that have repeatedly failed to load — avoids retrying every
// detect cycle (1.5s) when the environment clearly doesn't support them.
const failedModels: Set<string> = new Set()

/**
 * Check if a use case has any specialized models registered.
 */
export function hasSpecializedModel(useCaseId: string): boolean {
  const configs = MODEL_REGISTRY[useCaseId]
  return !!(configs && configs.length > 0)
}

/**
 * Get the list of specialized model configs for a use case.
 */
export function getSpecializedModels(useCaseId: string): ModelConfig[] {
  return MODEL_REGISTRY[useCaseId] ?? []
}

/**
 * Get the primary (first) model info for a use case (for UI display).
 */
export function getSpecializedModelInfo(useCaseId: string): { modelId: string; modelName: string } | null {
  const configs = MODEL_REGISTRY[useCaseId]
  if (!configs || configs.length === 0) return null
  return { modelId: configs[0].modelId, modelName: configs[0].modelName }
}

/**
 * Get ALL model names for a use case (for UI display — shows the full ensemble).
 */
export function getAllModelNames(useCaseId: string): string[] {
  const configs = MODEL_REGISTRY[useCaseId] ?? []
  return configs.map(c => c.modelName)
}

/**
 * Get the full model configs for a use case (for UI display / debugging).
 */
export function getSpecializedModelConfig(useCaseId: string): ModelConfig[] {
  return MODEL_REGISTRY[useCaseId] ?? []
}

/**
 * Run ALL specialized models for a use case in parallel (ensemble).
 * Returns an array of detections, one per model.
 *
 * The caller (camera-view) merges these with COCO-SSD detections and
 * pixel-anomaly results to form the final detection set.
 */
export async function runSpecializedDetectionEnsemble(
  canvas: HTMLCanvasElement,
  useCaseId: string
): Promise<SpecializedDetection[]> {
  const configs = MODEL_REGISTRY[useCaseId]
  if (!configs || configs.length === 0) return []

  // Run all models in parallel
  const results = await Promise.allSettled(
    configs.map(config => runSingleModel(canvas, useCaseId, config))
  )

  // Collect successful results; log failures
  const detections: SpecializedDetection[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled' && result.value) {
      detections.push(result.value)
    } else if (result.status === 'rejected') {
      console.warn(`[SpecializedModels] Model ${configs[i].modelName} rejected:`, result.reason)
    }
  }
  return detections
}

/**
 * Run a single specialized model on a canvas frame.
 */
async function runSingleModel(
  canvas: HTMLCanvasElement,
  useCaseId: string,
  entry: ModelConfig
): Promise<SpecializedDetection | null> {
  // If we've previously failed to load this model, return a "load_failed"
  // sentinel quickly — avoids re-trying on every detect cycle (1.5s).
  if (failedModels.has(entry.modelId)) {
    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: 0,
      label: 'load_failed',
      details: `${entry.modelName}: model unavailable in this environment`,
      source: entry.source,
    }
  }

  try {
    const { pipeline, env } = await import('@huggingface/transformers')

    let classifier = pipelineCache.get(entry.modelId)
    if (!classifier) {
      console.log(`[SpecializedModels] Loading ${entry.modelName} (${entry.modelId})...`)

      env.allowLocalModels = false
      env.useBrowserCache = true

      let lastErr: unknown = null
      type Dtype = 'q4' | 'q8' | 'fp32' | 'fp16' | 'auto' | 'int8' | 'uint8'
      const tryLoad = async (device: 'webgpu' | 'wasm', dtype?: Dtype) => {
        console.log(`[SpecializedModels] Trying backend: ${device}${dtype ? ` (dtype=${dtype})` : ''}`)
        try {
          const opts: Record<string, unknown> = { device }
          if (dtype) opts.dtype = dtype
          return await pipeline(entry.task, entry.modelId, opts as any)
        } catch (e) {
          lastErr = e
          console.warn(`[SpecializedModels] ${device} backend failed:`, e instanceof Error ? e.message : e)
          return null
        }
      }

      let webgpuAvailable = false
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
          webgpuAvailable = !!adapter
        } catch {
          webgpuAvailable = false
        }
      }

      if (webgpuAvailable) {
        classifier = await tryLoad('webgpu', 'q4') ?? await tryLoad('webgpu')
      }
      if (!classifier) {
        classifier = await tryLoad('wasm', 'q8') ?? await tryLoad('wasm')
      }

      if (!classifier) {
        console.error(`[SpecializedModels] All backends failed for ${entry.modelId}. Last error:`, lastErr)
        failedModels.add(entry.modelId)
        return {
          modelId: entry.modelId,
          modelName: entry.modelName,
          useCaseId,
          detected: false,
          confidence: 0,
          label: 'load_failed',
          details: `${entry.modelName}: model unavailable in this environment`,
          source: entry.source,
        }
      }

      pipelineCache.set(entry.modelId, classifier)
      console.log(`[SpecializedModels] ${entry.modelName} loaded successfully`)
    }

    // Run inference based on task type
    if (entry.task === 'zero-shot-image-classification') {
      return await runZeroShotClassification(canvas, entry, useCaseId, classifier)
    } else {
      return await runImageClassification(canvas, entry, useCaseId, classifier)
    }
  } catch (err) {
    console.error(`[SpecializedModels] Error running ${entry.modelId}:`, err)
    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: 0,
      label: 'inference_error',
      details: `${entry.modelName}: ${err instanceof Error ? err.message : 'unknown error'}`,
      source: entry.source,
    }
  }
}

/**
 * Run standard image-classification (e.g., fire detection ViT).
 */
async function runImageClassification(
  canvas: HTMLCanvasElement,
  entry: ImageClassificationConfig,
  useCaseId: string,
  classifier: any
): Promise<SpecializedDetection> {
  const results = await classifier(canvas)
  if (!Array.isArray(results) || results.length === 0) {
    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: 0,
      label: 'none',
      details: `${entry.modelName}: no detection`,
      source: entry.source,
    }
  }

  const top = results[0]
  const labelLower = (top.label || '').toLowerCase()
  const isPositive = entry.positiveLabels.some(l => labelLower.includes(l.toLowerCase()))

  const detected = isPositive && top.score > entry.threshold
  return {
    modelId: entry.modelId,
    modelName: entry.modelName,
    useCaseId,
    detected,
    confidence: top.score,
    label: top.label,
    details: `${entry.modelName}: ${top.label} (${(top.score * 100).toFixed(1)}%)${detected ? ' ⚠ DETECTED' : ''}`,
    source: entry.source,
  }
}

/**
 * Run CLIP zero-shot image classification.
 */
async function runZeroShotClassification(
  canvas: HTMLCanvasElement,
  entry: ZeroShotConfig,
  useCaseId: string,
  classifier: any
): Promise<SpecializedDetection> {
  const results = await classifier(canvas, entry.candidateLabels)

  if (!Array.isArray(results) || results.length === 0) {
    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: 0,
      label: 'none',
      details: `${entry.modelName}: no detection`,
      source: entry.source,
    }
  }

  let bestPositive: { score: number; label: string } | null = null
  for (const r of results) {
    const idx = entry.candidateLabels.indexOf(r.label)
    if (entry.positiveIndices.includes(idx)) {
      if (!bestPositive || r.score > bestPositive.score) {
        bestPositive = { score: r.score, label: r.label }
      }
    }
  }

  const overallTop = results[0]

  if (!bestPositive) {
    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: overallTop?.score ?? 0,
      label: overallTop?.label ?? 'none',
      details: `${entry.modelName}: top="${overallTop?.label ?? 'none'}" (${((overallTop?.score ?? 0) * 100).toFixed(1)}%) — no positive class scored`,
      source: entry.source,
    }
  }

  const detected = bestPositive.score > entry.threshold
  return {
    modelId: entry.modelId,
    modelName: entry.modelName,
    useCaseId,
    detected,
    confidence: bestPositive.score,
    label: bestPositive.label,
    details: `${entry.modelName}: "${bestPositive.label}" (${(bestPositive.score * 100).toFixed(1)}%)${detected ? ' ⚠ DETECTED' : ''}`,
    source: entry.source,
  }
}

/**
 * Clear the pipeline cache (e.g., on camera switch or session end).
 * Also resets the failed-models set so retries can happen on a fresh session.
 */
export function clearSpecializedModelCache() {
  pipelineCache.clear()
  failedModels.clear()
}

/**
 * Get all registered specialized models for UI display.
 */
export function getRegisteredModels(): Array<{
  useCaseId: string
  modelId: string
  modelName: string
  task: ModelTask
  source: string
  threshold: number
}> {
  const result: Array<{ useCaseId: string; modelId: string; modelName: string; task: ModelTask; source: string; threshold: number }> = []
  for (const [useCaseId, configs] of Object.entries(MODEL_REGISTRY)) {
    for (const entry of configs) {
      result.push({
        useCaseId,
        modelId: entry.modelId,
        modelName: entry.modelName,
        task: entry.task,
        source: entry.source,
        threshold: entry.threshold,
      })
    }
  }
  return result
}

/**
 * Pre-warm the CLIP model in the background (call once on app load).
 * Subsequent zero-shot use cases will reuse the cached pipeline.
 */
export async function prewarmClipModel(): Promise<boolean> {
  const clipModelId = 'Xenova/clip-vit-base-patch32'
  if (pipelineCache.has(clipModelId)) return true
  if (failedModels.has(clipModelId)) return false

  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true

    console.log(`[SpecializedModels] Prewarming CLIP model...`)
    let classifier: any = null
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
        if (adapter) {
          try {
            classifier = await pipeline('zero-shot-image-classification', clipModelId, { device: 'webgpu', dtype: 'q4' } as any)
          } catch (e) {
            console.warn('[SpecializedModels] WebGPU prewarm failed, falling back to WASM:', e instanceof Error ? e.message : e)
          }
        }
      } catch { /* no webgpu */ }
    }
    if (!classifier) {
      try {
        classifier = await pipeline('zero-shot-image-classification', clipModelId, { device: 'wasm', dtype: 'q8' } as any)
      } catch (e) {
        classifier = await pipeline('zero-shot-image-classification', clipModelId, { device: 'wasm' } as any)
      }
    }
    if (classifier) {
      pipelineCache.set(clipModelId, classifier)
      console.log(`[SpecializedModels] CLIP prewarmed successfully`)
      return true
    }
    failedModels.add(clipModelId)
    return false
  } catch (err) {
    console.warn('[SpecializedModels] CLIP prewarm failed:', err)
    failedModels.add(clipModelId)
    return false
  }
}

// ─── Legacy single-model API (backward compatibility) ─────────────────────
// Some callers may still use the old single-model interface. This runs the
// FIRST model in the ensemble and returns its result.

export async function runSpecializedDetection(
  canvas: HTMLCanvasElement,
  useCaseId: string
): Promise<SpecializedDetection | null> {
  const detections = await runSpecializedDetectionEnsemble(canvas, useCaseId)
  if (detections.length === 0) return null
  // Return the first non-load-failed detection, or the first overall
  const firstValid = detections.find(d => d.label !== 'load_failed' && d.label !== 'inference_error')
  return firstValid || detections[0]
}
