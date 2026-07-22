/**
 * Specialized Hugging Face model loader for use cases where COCO-SSD flounders.
 *
 * Uses @huggingface/transformers (transformers.js v4) to run ONNX models
 * in-browser via WebGPU/WASM. Models are loaded lazily and cached.
 *
 * ─── Model Strategy (v2 — 2026-07-21) ───────────────────────────────────
 *
 * 1. **Dedicated ONNX classifier** for fire_smoke:
 *    prithivMLmods/Fire-Detection-Engine-ONNX (3-class ViT, ~50MB).
 *
 * 2. **CLIP zero-shot classification** as the universal backbone for:
 *    graffiti, flood_watch, landslide_watch, post_quake (cracks), slip_hazard.
 *    - Model: Xenova/clip-vit-base-patch32 (~153MB quantized, loaded ONCE).
 *    - Each use case provides its own candidateLabels + positiveIndices.
 *    - This works for ANY visual task by passing custom text labels.
 *
 * 3. **COCO-SSD remains** for: intrusion, after_hours, parking, queue_anomaly,
 *    crowd_surge, abandoned_object (these all have appropriate COCO classes:
 *    person, car, backpack, suitcase, handbag).
 *
 * 4. **Pixel-anomaly** (pixel-anomaly.ts) remains as a LAST-RESORT fallback
 *    if HF model loading fails entirely (e.g., offline mode).
 *
 * ELI5: "Different AI models are good at different things. COCO-SSD detects
 * people and cars. A specialized fire model detects fire. CLIP can recognize
 * ANY concept (floods, cracks, graffiti) by comparing the image to text
 * descriptions. We use the right tool for each job."
 *
 * ARCHITECTURE:
 *   1. COCO-SSD runs first (always) — detects persons, cars, backpacks, etc.
 *   2. If the active use case has a specialized model, it runs IN PARALLEL
 *   3. If either model detects something, the agent pipeline triggers
 *   4. If the HF model fails to load, fall back to pixel-anomaly
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
}

// ─── Model config types ────────────────────────────────────────────────────
type ModelTask = 'image-classification' | 'zero-shot-image-classification'

interface BaseModelConfig {
  modelId: string
  modelName: string
  task: ModelTask
  /** Confidence threshold for triggering a detection */
  threshold: number
}

interface ImageClassificationConfig extends BaseModelConfig {
  task: 'image-classification'
  /** Substrings to match against model output labels (case-insensitive) */
  positiveLabels: string[]
}

interface ZeroShotConfig extends BaseModelConfig {
  task: 'zero-shot-image-classification'
  /** Candidate labels to pass to CLIP — the model will score each one */
  candidateLabels: string[]
  /** Indices into candidateLabels that count as a "positive" detection */
  positiveIndices: number[]
}

type ModelConfig = ImageClassificationConfig | ZeroShotConfig

// ─── Model Registry ────────────────────────────────────────────────────────
// Maps use case IDs → model config. Use cases not in this map rely on
// COCO-SSD alone (intrusion, after_hours, parking, queue_anomaly, crowd_surge,
// abandoned_object, incident_description, auto_report, visual_memory).
const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ─── Dedicated ONNX classifier ───
  fire_smoke: {
    modelId: 'prithivMLmods/Fire-Detection-Engine-ONNX',
    modelName: 'Fire Detection Engine',
    task: 'image-classification',
    positiveLabels: ['fire needed action', 'smoky'],
    threshold: 0.5,
  },

  // ─── CLIP zero-shot (universal backbone) ───
  graffiti: {
    modelId: 'Xenova/clip-vit-base-patch32',
    modelName: 'Graffiti/Vandalism (CLIP zero-shot)',
    task: 'zero-shot-image-classification',
    candidateLabels: [
      'graffiti spray painted on a wall',
      'vandalism and property damage',
      'a clean undamaged wall',
      'a normal street scene',
    ],
    positiveIndices: [0, 1],
    // CLIP zero-shot probabilities are spread across 4 labels; a "confident"
    // detection typically scores 0.15-0.30 for the top label. Use 0.15.
    threshold: 0.15,
  },

  flood_watch: {
    modelId: 'Xenova/clip-vit-base-patch32',
    modelName: 'Flood Detection (CLIP zero-shot)',
    task: 'zero-shot-image-classification',
    candidateLabels: [
      'a flooded street submerged in water',
      'a flooded area with rising water',
      'a dry normal street',
      'a normal dry landscape',
    ],
    positiveIndices: [0, 1],
    threshold: 0.20,
  },

  landslide_watch: {
    modelId: 'Xenova/clip-vit-base-patch32',
    modelName: 'Landslide Detection (CLIP zero-shot)',
    task: 'zero-shot-image-classification',
    candidateLabels: [
      'a landslide with mud and debris flow',
      'a slope failure with exposed earth',
      'stable vegetated terrain',
      'a normal intact hillside',
    ],
    positiveIndices: [0, 1],
    threshold: 0.15,
  },

  post_quake: {
    modelId: 'Xenova/clip-vit-base-patch32',
    modelName: 'Crack Detection (CLIP zero-shot)',
    task: 'zero-shot-image-classification',
    candidateLabels: [
      'a wall with deep structural cracks',
      'concrete with cracks and spalling damage',
      'a smooth intact concrete surface',
      'an undamaged wall',
    ],
    positiveIndices: [0, 1],
    threshold: 0.20,
  },

  slip_hazard: {
    modelId: 'Xenova/clip-vit-base-patch32',
    modelName: 'Slip Hazard (CLIP zero-shot)',
    task: 'zero-shot-image-classification',
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
}

// Cache loaded pipeline functions — keyed by modelId (so CLIP is loaded once,
// shared by all zero-shot use cases).
const pipelineCache: Map<string, any> = new Map()

// Track models that have repeatedly failed to load — avoids retrying every
// detect cycle (1.5s) when the environment clearly doesn't support them.
const failedModels: Set<string> = new Set()

/**
 * Check if a specialized model is available for this use case.
 */
export function hasSpecializedModel(useCaseId: string): boolean {
  return useCaseId in MODEL_REGISTRY
}

/**
 * Get the model info for a use case.
 */
export function getSpecializedModelInfo(useCaseId: string): { modelId: string; modelName: string } | null {
  const entry = MODEL_REGISTRY[useCaseId]
  return entry ? { modelId: entry.modelId, modelName: entry.modelName } : null
}

/**
 * Get the full model config for a use case (for UI display / debugging).
 */
export function getSpecializedModelConfig(useCaseId: string): ModelConfig | null {
  return MODEL_REGISTRY[useCaseId] ?? null
}

/**
 * Run specialized model inference on a canvas frame.
 *
 * Returns null if:
 *   - No specialized model for this use case
 *   - Model failed to load AND fallback was requested
 *   - Inference failed AND caller requested no fallback
 *
 * Returns a SpecializedDetection with `label: 'load_failed'` if the model
 * could not be loaded in this environment (callers should fall back to
 * pixel-anomaly detection in this case).
 */
export async function runSpecializedDetection(
  canvas: HTMLCanvasElement,
  useCaseId: string
): Promise<SpecializedDetection | null> {
  const entry = MODEL_REGISTRY[useCaseId]
  if (!entry) return null

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
    }
  }

  try {
    // Dynamic import — code-split so transformers.js only loads when needed
    const { pipeline, env } = await import('@huggingface/transformers')

    // Get or create pipeline (cached by modelId so CLIP is loaded ONCE)
    let classifier = pipelineCache.get(entry.modelId)
    if (!classifier) {
      console.log(`[SpecializedModels] Loading ${entry.modelName} (${entry.modelId})...`)

      // Allow remote model download from HuggingFace CDN
      env.allowLocalModels = false
      env.useBrowserCache = true

      // Try WebGPU first (if a real adapter is available), then fall back to WASM.
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

      // 1. Check WebGPU availability by requesting an adapter
      let webgpuAvailable = false
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
          webgpuAvailable = !!adapter
        } catch {
          webgpuAvailable = false
        }
      }

      // 2. Try the appropriate backend
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
        }
      }

      pipelineCache.set(entry.modelId, classifier)
      console.log(`[SpecializedModels] ${entry.modelName} loaded successfully`)
    }

    // ─── Run inference based on task type ───
    if (entry.task === 'zero-shot-image-classification') {
      return await runZeroShotClassification(canvas, entry, useCaseId, classifier)
    } else {
      return await runImageClassification(canvas, entry, useCaseId, classifier)
    }
  } catch (err) {
    console.error(`[SpecializedModels] Error running ${entry.modelId}:`, err)
    // Don't mark as failed on inference error — could be transient (canvas not ready)
    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: 0,
      label: 'inference_error',
      details: `${entry.modelName}: ${err instanceof Error ? err.message : 'unknown error'}`,
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
    }
  }

  // Models may return [{label, score}] or [{label, score}, ...] sorted desc
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
  }
}

/**
 * Run CLIP zero-shot image classification.
 * Passes candidate text labels; CLIP scores each label against the image.
 */
async function runZeroShotClassification(
  canvas: HTMLCanvasElement,
  entry: ZeroShotConfig,
  useCaseId: string,
  classifier: any
): Promise<SpecializedDetection> {
  // transformers.js zero-shot-image-classification returns
  // [{ score, label }] sorted by score descending
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
    }
  }

  // Find the highest-scoring POSITIVE label
  let bestPositive: { score: number; label: string } | null = null
  for (const r of results) {
    const idx = entry.candidateLabels.indexOf(r.label)
    if (entry.positiveIndices.includes(idx)) {
      if (!bestPositive || r.score > bestPositive.score) {
        bestPositive = { score: r.score, label: r.label }
      }
    }
  }

  // Also report the overall top label for trace visibility
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
  threshold: number
}> {
  return Object.entries(MODEL_REGISTRY).map(([useCaseId, entry]) => ({
    useCaseId,
    modelId: entry.modelId,
    modelName: entry.modelName,
    task: entry.task,
    threshold: entry.threshold,
  }))
}

/**
 * Pre-warm the CLIP model in the background (call once on app load,
 * e.g., when the user first opens the prototype tab).
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
    // Use WASM with q8 for max compatibility (will be upgraded to WebGPU on demand)
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
        // Last-resort: default dtype
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
