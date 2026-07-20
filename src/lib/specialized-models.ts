/**
 * Specialized Hugging Face model loader for use cases where COCO-SSD flounders.
 *
 * Uses @huggingface/transformers (transformers.js v4) to run ONNX models
 * in-browser via WebGPU/WASM. Models are loaded lazily and cached.
 *
 * Available models:
 *   - Fire detection: prithivMLmods/Fire-Detection-Engine-ONNX (image classification)
 *   - Additional models can be added as they become available on HuggingFace
 *     with ONNX + transformers.js support
 *
 * ELI5: "Some things like fire can't be detected by the main AI model because
 * it wasn't trained on them. So we use specialized AI models from Hugging Face
 * that were trained specifically to detect fire. These run in your browser
 * without sending data to any server."
 *
 * ARCHITECTURE:
 *   1. COCO-SSD runs first (always) — detects persons, cars, backpacks, etc.
 *   2. If the active use case has a specialized model, it runs IN PARALLEL
 *   3. If either model detects something, the agent pipeline triggers
 *
 * The pixel anomaly detector (pixel-anomaly.ts) remains as a fallback for
 * use cases where no HuggingFace ONNX model is available yet (flood, landslide,
 * post-quake crack detection).
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

// Model registry — maps use case IDs to HuggingFace model IDs
const MODEL_REGISTRY: Record<string, {
  modelId: string
  modelName: string
  task: 'image-classification'
}> = {
  fire_smoke: {
    modelId: 'prithivMLmods/Fire-Detection-Engine-ONNX',
    modelName: 'Fire Detection Engine',
    task: 'image-classification',
  },
  // Additional models will be added here as they become available on
  // HuggingFace with ONNX + transformers.js support:
  // - flood_watch: prithivMLmods/Flood-Image-Detection (needs ONNX conversion)
  // - post_quake: crack detection model (needs ONNX conversion)
  // - graffiti: vandalism detection model (needs ONNX conversion)
}

// Cache loaded pipeline functions
const pipelineCache: Map<string, any> = new Map()

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
 * Run specialized model inference on a canvas frame.
 *
 * This dynamically imports @huggingface/transformers (code-split) to avoid
 * loading the library unless a specialized model is actually needed.
 *
 * Returns null if:
 *   - No specialized model for this use case
 *   - Model failed to load
 *   - Inference failed
 */
export async function runSpecializedDetection(
  canvas: HTMLCanvasElement,
  useCaseId: string
): Promise<SpecializedDetection | null> {
  const entry = MODEL_REGISTRY[useCaseId]
  if (!entry) return null

  try {
    // Dynamic import — code-split so transformers.js only loads when needed
    const { pipeline } = await import('@huggingface/transformers')

    // Get or create pipeline
    let classifier = pipelineCache.get(entry.modelId)
    if (!classifier) {
      console.log(`[SpecializedModels] Loading ${entry.modelName} (${entry.modelId})...`)
      classifier = await pipeline('image-classification', entry.modelId, {
        device: 'webgpu',
        dtype: 'q4',
      })
      pipelineCache.set(entry.modelId, classifier)
    }

    // Run inference
    const results = await classifier(canvas)

    // Parse results — image classification returns [{ label, score }]
    if (Array.isArray(results) && results.length > 0) {
      const top = results[0]
      const isFire = top.label.toLowerCase().includes('fire') || top.label.toLowerCase().includes('smoke')
      return {
        modelId: entry.modelId,
        modelName: entry.modelName,
        useCaseId,
        detected: isFire && top.score > 0.5,
        confidence: top.score,
        label: top.label,
        details: `${entry.modelName}: ${top.label} (${(top.score * 100).toFixed(1)}%)`,
      }
    }

    return {
      modelId: entry.modelId,
      modelName: entry.modelName,
      useCaseId,
      detected: false,
      confidence: 0,
      label: 'none',
      details: `${entry.modelName}: no detection`,
    }
  } catch (err) {
    console.error(`[SpecializedModels] Error running ${entry.modelId}:`, err)
    return null
  }
}

/**
 * Clear the pipeline cache (e.g., on camera switch or session end).
 */
export function clearSpecializedModelCache() {
  pipelineCache.clear()
}

/**
 * Get all registered specialized models for UI display.
 */
export function getRegisteredModels(): Array<{ useCaseId: string; modelId: string; modelName: string }> {
  return Object.entries(MODEL_REGISTRY).map(([useCaseId, entry]) => ({
    useCaseId,
    modelId: entry.modelId,
    modelName: entry.modelName,
  }))
}
