/**
 * Multi-Model Ensemble Framework for Vision Agent
 *
 * ─── Architecture (v4 — 2026-07-22) ──────────────────────────────────────
 *
 * Every use case runs MULTIPLE models simultaneously (MoE-style ensemble):
 *
 * 1. **YOLOS-tiny** (when selected) — detects persons, cars, backpacks, etc.
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
 * about multi-model agreement (e.g., "YOLOS-tiny detected a person AND the
 * fire model detected fire → high-confidence incident").
 *
 * ELI5: "We don't rely on just one AI model. For every camera, we run
 * several models at the same time — like having multiple security guards
 * each looking for different things. If any of them spots something, we
 * alert. If multiple spot the same thing, we're even more confident."
 */

import type { PixelAnomalyResult } from './pixel-anomaly'
import { ALL_MODELS, getModelById } from './models/registry'
import { selectPoseGeometry } from './models/pose-geometry'

export interface SpecializedDetection {
  modelId: string
  modelName: string
  useCaseId: string
  detected: boolean
  confidence: number
  label: string
  details: string
  bbox?: [number, number, number, number]
  /** Which model layer produced this detection (for ensemble traceability) */
  source: 'dedicated' | 'clip-zero-shot' | 'pixel-anomaly'
}

// ─── Model config types ────────────────────────────────────────────────────
type ModelTask = 'image-classification' | 'zero-shot-image-classification' | 'image-segmentation' | 'pose-estimation'

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

interface SegmentationConfig extends BaseModelConfig {
  task: 'image-segmentation'
  positiveLabels: string[]
}

interface PoseConfig extends BaseModelConfig {
  task: 'pose-estimation'
}

type ModelConfig = ImageClassificationConfig | ZeroShotConfig | SegmentationConfig | PoseConfig

// ─── Multi-Model Registry ──────────────────────────────────────────────────
// Each use case maps to an ARRAY of model configs. All run in parallel.
// The pinned YOLOS adapter is handled separately in camera-view.
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
      modelId: 'Xenova/segformer-b0-finetuned-ade-512-512',
      modelName: 'SegFormer-B0 water segmentation',
      task: 'image-segmentation',
      source: 'dedicated',
      positiveLabels: ['water', 'sea', 'river', 'lake', 'swimming pool'],
      threshold: 0.02,
    },
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
      modelId: 'Xenova/yolov8n-pose',
      modelName: 'YOLOv8n-Pose fall geometry',
      task: 'pose-estimation',
      source: 'dedicated',
      threshold: 0.3,
    },
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
const posePipelineCache: Map<string, { model: any; processor: any }> = new Map()

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
 * The caller (camera-view) merges these with pinned YOLOS detections and
 * pixel-anomaly results to form the final detection set.
 */
export async function runSpecializedDetectionEnsemble(
  canvas: HTMLCanvasElement,
  useCaseId: string,
  selectedModelIds: string[],
): Promise<SpecializedDetection[]> {
  const selectedModels = selectedModelIds
    .map(getModelById)
    .filter(model => model?.adapterImplemented && model.browserReady && model.revision)
  const selectedRemoteModels = new Map(selectedModels.map(model => [model!.modelId, model!]))
  const configs = (MODEL_REGISTRY[useCaseId] ?? [])
    .filter(config => selectedRemoteModels.has(config.modelId))
  if (!configs || configs.length === 0) return []

  // Run all models in parallel with a timeout per model (R04 fix).
  // First load (model download from HuggingFace CDN) can take 60-120s for
  // large models (CLIP ~153MB, Fire ViT ~50MB). Subsequent inferences are
  // fast (2-5s). Use a longer timeout if the model isn't cached yet.
  const results = await Promise.allSettled(
    configs.map(config => {
      const isCached = pipelineCache.has(config.modelId)
      const timeout = isCached ? 30_000 : 120_000 // 30s for cached, 120s for first download
      const revision = selectedRemoteModels.get(config.modelId)!.revision!
      return withTimeout(runSingleModel(canvas, useCaseId, config, revision), timeout, config.modelName)
    })
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
  entry: ModelConfig,
  revision: string,
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
    if (entry.task === 'pose-estimation') {
      return await runPoseEstimation(canvas, entry, useCaseId, revision)
    }
    const { pipeline, env } = await import('@huggingface/transformers')

    let classifier = pipelineCache.get(entry.modelId)
    if (!classifier) {
      console.log(`[SpecializedModels] Loading ${entry.modelName} (${entry.modelId})...`)

      env.allowLocalModels = false
      env.useBrowserCache = true

      let lastErr: unknown = null
      type Dtype = 'q4' | 'q8' | 'fp32' | 'fp16' | 'auto' | 'int8' | 'uint8'
      const tryLoad = async (device: 'wasm', dtype?: Dtype) => {
        console.log(`[SpecializedModels] Trying backend: ${device}${dtype ? ` (dtype=${dtype})` : ''}`)
        try {
          const opts: Record<string, unknown> = { device, revision }
          if (dtype) opts.dtype = dtype
          return await pipeline(entry.task, entry.modelId, opts as any)
        } catch (e) {
          lastErr = e
          console.warn(`[SpecializedModels] ${device} backend failed:`, e instanceof Error ? e.message : e)
          return null
        }
      }

      // Always use WASM — WebGPU is broken in onnxruntime-web 1.26.0-dev
      // (webgpuInit is not a function). WASM is universally supported.
      classifier = await tryLoad('wasm', 'q8') ?? await tryLoad('wasm')

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
    } else if (entry.task === 'image-segmentation') {
      return await runImageSegmentation(canvas, entry, useCaseId, classifier)
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

async function runPoseEstimation(
  canvas: HTMLCanvasElement,
  entry: PoseConfig,
  useCaseId: string,
  revision: string,
): Promise<SpecializedDetection> {
  const { AutoModel, AutoProcessor, RawImage, env } = await import('@huggingface/transformers')
  env.allowLocalModels = false
  env.useBrowserCache = true

  let adapter = posePipelineCache.get(entry.modelId)
  if (!adapter) {
    const options = { revision, device: 'wasm', dtype: 'q8' } as any
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(entry.modelId, options),
      AutoProcessor.from_pretrained(entry.modelId, { revision }),
    ])
    adapter = { model, processor }
    posePipelineCache.set(entry.modelId, adapter)
  }

  const image = RawImage.fromCanvas(canvas)
  const processed = await adapter.processor(image)
  const output = await adapter.model({ images: processed.pixel_values })
  const tensor = output.output0
  const raw = tensor?.tolist?.()?.[0] as number[][] | undefined
  if (!raw?.length) {
    return noPoseDetection(entry, useCaseId, 'model returned no poses')
  }

  // Export shape is commonly [56, 8400]; accept [8400, 56] as well.
  const rows = raw.length === 56
    ? Array.from({ length: raw[0]?.length ?? 0 }, (_, row) => raw.map(column => Number(column[row])))
    : raw
  const inputHeight = Number(processed.reshaped_input_sizes?.[0]?.[0] ?? canvas.height)
  const inputWidth = Number(processed.reshaped_input_sizes?.[0]?.[1] ?? canvas.width)
  const best = selectPoseGeometry(rows, entry.threshold, inputWidth, inputHeight, canvas.width, canvas.height)

  if (!best) return noPoseDetection(entry, useCaseId, 'no person pose exceeded the confidence threshold')
  return {
    modelId: entry.modelId,
    modelName: entry.modelName,
    useCaseId,
    detected: best.horizontal,
    confidence: best.score,
    label: best.horizontal ? 'fall_candidate' : 'upright_pose',
    details: `${entry.modelName}: ${best.horizontal ? 'horizontal fall geometry' : 'upright geometry'} (${(best.score * 100).toFixed(1)}%)`,
    bbox: best.bbox,
    source: entry.source,
  }
}

function noPoseDetection(entry: PoseConfig, useCaseId: string, reason: string): SpecializedDetection {
  return {
    modelId: entry.modelId,
    modelName: entry.modelName,
    useCaseId,
    detected: false,
    confidence: 0,
    label: 'none',
    details: `${entry.modelName}: ${reason}`,
    source: entry.source,
  }
}

async function runImageSegmentation(
  canvas: HTMLCanvasElement,
  entry: SegmentationConfig,
  useCaseId: string,
  segmenter: any,
): Promise<SpecializedDetection> {
  const results = await segmenter(canvas)
  const positives = Array.isArray(results)
    ? results.filter(result => entry.positiveLabels.some(label => String(result.label ?? '').toLowerCase().includes(label)))
    : []
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = -1
  let maxY = -1
  let positivePixels = 0
  let totalPixels = 0
  let maskWidth = 0
  let maskHeight = 0

  for (const result of positives) {
    const mask = result.mask
    const width = Number(mask?.width ?? 0)
    const height = Number(mask?.height ?? 0)
    const data = mask?.data as ArrayLike<number> | undefined
    if (!width || !height || !data) continue
    maskWidth = width
    maskHeight = height
    totalPixels = Math.max(totalPixels, width * height)
    const channels = Math.max(1, Math.floor(data.length / (width * height)))
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      if (Number(data[pixel * channels]) <= 0) continue
      positivePixels += 1
      const x = pixel % width
      const y = Math.floor(pixel / width)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  const coverage = totalPixels > 0 ? Math.min(1, positivePixels / totalPixels) : 0
  const detected = coverage >= entry.threshold
  const bbox = detected && maxX >= minX && maxY >= minY
    ? [
        minX / maskWidth * canvas.width,
        minY / maskHeight * canvas.height,
        (maxX - minX + 1) / maskWidth * canvas.width,
        (maxY - minY + 1) / maskHeight * canvas.height,
      ] as [number, number, number, number]
    : undefined

  return {
    modelId: entry.modelId,
    modelName: entry.modelName,
    useCaseId,
    detected,
    confidence: coverage,
    label: positives.map(result => String(result.label)).join(', ') || 'none',
    details: `${entry.modelName}: ${(coverage * 100).toFixed(1)}% water-class coverage${detected ? ' ⚠ DETECTED' : ''}`,
    bbox,
    source: entry.source,
  }
}

/** Run standard image-classification (e.g., fire detection ViT). */
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
  posePipelineCache.clear()
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
  const clipRevision = getModelById('clip-zero-shot')?.revision
  if (!clipRevision) return false
  if (pipelineCache.has(clipModelId)) return true
  if (failedModels.has(clipModelId)) return false

  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true

    console.log(`[SpecializedModels] Prewarming CLIP model...`)
    let classifier: any = null
    // Always use WASM — WebGPU is broken in onnxruntime-web 1.26.0-dev
    try {
      classifier = await pipeline('zero-shot-image-classification', clipModelId, { revision: clipRevision, device: 'wasm', dtype: 'q8' } as any)
    } catch (e) {
      classifier = await pipeline('zero-shot-image-classification', clipModelId, { revision: clipRevision, device: 'wasm' } as any)
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
  const availableIds = ALL_MODELS
    .filter(model => model.adapterImplemented && model.browserReady && model.revision)
    .map(model => model.id)
  const detections = await runSpecializedDetectionEnsemble(canvas, useCaseId, availableIds)
  if (detections.length === 0) return null
  // Return the first non-load-failed detection, or the first overall
  const firstValid = detections.find(d => d.label !== 'load_failed' && d.label !== 'inference_error')
  return firstValid || detections[0]
}

// ─── Timeout helper (R04: prevent HF model loading from hanging indefinitely) ─
/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * `ms` milliseconds, returns a "timeout" sentinel detection instead of
 * hanging forever.
 */
async function withTimeout(
  promise: Promise<SpecializedDetection | null>,
  ms: number,
  modelName: string
): Promise<SpecializedDetection | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<SpecializedDetection | null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[SpecializedModels] ${modelName} timed out after ${ms}ms`)
      resolve({
        modelId: '',
        modelName,
        useCaseId: '',
        detected: false,
        confidence: 0,
        label: 'timeout',
        details: `${modelName}: timed out after ${ms}ms`,
        source: 'dedicated',
      })
    }, ms)
  })
  try {
    const result = await Promise.race([promise, timeoutPromise])
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}
