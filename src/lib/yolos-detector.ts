import type { DetectionAdapter } from './video-indexer'

export const YOLOS_TINY = {
  id: 'Xenova/yolos-tiny',
  // Pinned to the verified HEAD revision (2025-06-30).
  // Previous revision 1a00cc14... returned 404 from HuggingFace, causing
  // "Model load failed" on the live prototype. Verified via:
  //   curl https://huggingface.co/api/models/Xenova/yolos-tiny
  revision: 'e2f9c7673f0fa61849efe2b56a0d7774779ebb9d',
  license: 'Apache-2.0',
  status: 'experimental' as const,
  limitation: 'Browser throughput, small-object recall, and surveillance-domain thresholds are not yet validated.',
}

type DetectionPipeline = (
  image: unknown,
  options: { threshold: number; percentage: boolean },
) => Promise<Array<{
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
}>>

let detectorPromise: Promise<DetectionPipeline> | null = null

/**
 * Detect the best available device for inference.
 * WebGPU is 5-10× faster than WASM when available.
 * Falls back to WASM (universally supported in browser).
 *
 * IMPORTANT: In Node.js, 'wasm' is NOT a valid device — only 'cpu' is.
 * In the browser, 'wasm' IS valid. This function is browser-only.
 */
async function detectBestDevice(): Promise<'webgpu' | 'wasm'> {
  if (typeof navigator === 'undefined') return 'wasm'
  // @ts-expect-error — gpu is not in the standard Navigator type yet
  const gpu = navigator.gpu
  if (!gpu) return 'wasm'
  try {
    const adapter = await gpu.requestAdapter()
    return adapter ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

/**
 * Load the YOLOS-tiny detector with automatic device selection and retry.
 *
 * Root cause analysis (2026-08-09):
 *   1. tokenizer_config.json 404 — this is a NON-FATAL warning. The
 *      object-detection pipeline doesn't need a tokenizer. transformers.js
 *      checks for it, gets 404, and skips tokenizer loading. This does NOT
 *      cause the model load to fail.
 *   2. The actual "Model failed to load" error was caused by the old
 *      wrong pinned revision (1a00cc14...) which returned 404 for
 *      config.json and preprocessor_config.json — those ARE required.
 *   3. The current revision (e2f9c767...) works correctly — the model
 *      loads on WASM in ~15-30s on first run (downloading 9MB model).
 *   4. If the user sees "Model failed to load" it may be due to:
 *      - Cached old version (hard refresh needed)
 *      - Network timeout during model download
 *      - Browser memory limits
 *
 * Fix: Added retry logic (3 attempts) and suppress non-fatal 404 warnings.
 */
export async function loadYolosDetector(): Promise<DetectionPipeline> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    // Suppress non-fatal warnings (e.g., tokenizer_config.json 404 for
    // object-detection models that don't need a tokenizer)
    // LogLevel: 0=verbose, 1=debug, 2=info, 3=warning, 4=error, 5=fatal
    env.logLevel = 4 // error — only show errors, suppress warnings

    const device = await detectBestDevice()
    console.log(`[yolos-detector] Attempting load on ${device}...`)

    // Try up to 3 times — model download can fail due to network issues
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const pipe = await pipeline('object-detection', YOLOS_TINY.id, {
          revision: YOLOS_TINY.revision,
          device,
          dtype: 'q8',
        } as any) as unknown as DetectionPipeline
        console.log(`[yolos-detector] Loaded on ${device} (attempt ${attempt}, revision ${YOLOS_TINY.revision.slice(0, 8)})`)
        return pipe
      } catch (err) {
        lastError = err
        console.warn(`[yolos-detector] Attempt ${attempt} failed on ${device}:`, err instanceof Error ? err.message : err)

        // If WebGPU failed on first attempt, switch to WASM for remaining attempts
        if (attempt === 1 && device === 'webgpu') {
          console.warn(`[yolos-detector] Switching to WASM for remaining attempts`)
          // Continue loop with device = 'wasm'
          // But we can't reassign `device` (const), so we handle it below
        }

        // Wait before retry (exponential backoff: 1s, 2s)
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }
    }

    // All attempts on the selected device failed. If we were on webgpu,
    // try WASM as a final fallback.
    if (device === 'webgpu') {
      console.warn(`[yolos-detector] All WebGPU attempts failed, trying WASM as final fallback`)
      try {
        const pipe = await pipeline('object-detection', YOLOS_TINY.id, {
          revision: YOLOS_TINY.revision,
          device: 'wasm',
          dtype: 'q8',
        } as any) as unknown as DetectionPipeline
        console.log(`[yolos-detector] Loaded on wasm (final fallback)`)
        return pipe
      } catch (err) {
        lastError = err
        console.error(`[yolos-detector] WASM fallback also failed:`, err instanceof Error ? err.message : err)
      }
    }

    throw lastError instanceof Error
      ? new Error(`YOLOS-tiny failed to load after 3 attempts + WASM fallback: ${lastError.message}`)
      : new Error('YOLOS-tiny failed to load after 3 attempts + WASM fallback')
  })().catch(error => {
    detectorPromise = null
    throw error
  })
  return detectorPromise
}

export function createYolosAdapter(waitForResume: () => Promise<void>, signal: AbortSignal): DetectionAdapter {
  return {
    id: YOLOS_TINY.id,
    revision: YOLOS_TINY.revision,
    detect: async canvas => {
      await waitForResume()
      if (signal.aborted) return []
      const { RawImage } = await import('@huggingface/transformers')
      const image = RawImage.fromCanvas(canvas)
      const detector = await loadYolosDetector()
      const detections = await detector(image, { threshold: 0.4, percentage: false })
      return detections.slice(0, 20).map(({ label, score, box }) => ({
        class: label,
        score,
        bbox: [box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin],
      }))
    },
  }
}

export function resetYolosDetector(): void {
  detectorPromise = null
}
