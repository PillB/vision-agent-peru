import type { DetectionAdapter } from './video-indexer'

export const YOLOS_TINY = {
  id: 'Xenova/yolos-tiny',
  // Pinned to the verified HEAD revision (2025-06-30).
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
 * Load the YOLOS-tiny detector with WASM backend and retry.
 *
 * ROOT CAUSE ANALYSIS (2026-08-09):
 *   1. tokenizer_config.json 404 — NON-FATAL. Object-detection pipeline
 *      doesn't need a tokenizer. transformers.js checks, gets 404, skips.
 *   2. "no available backend found" + "webgpuInit is not a function" —
 *      The onnxruntime-web dev build (1.26.0-dev) has a broken webgpuInit
 *      function. When transformers.js tries WebGPU first, it fails with
 *      this error, then the WASM fallback ALSO fails because the
 *      onnxruntime-web/webgpu import path doesn't properly initialize
 *      the WASM backend.
 *   3. FIX: Always use device: 'wasm' directly. Skip WebGPU entirely
 *      until onnxruntime-web stabilizes. WASM is universally supported
 *      and reliable. WebGPU would be 5-10× faster but the dev build is
 *      broken.
 *   4. Retry logic: 3 attempts with exponential backoff handles
 *      transient network failures during model download.
 */
export async function loadYolosDetector(): Promise<DetectionPipeline> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    // Suppress non-fatal warnings (tokenizer_config.json 404, attention
    // fusion warnings, device discovery logs)
    env.logLevel = 4 // error only

    // Always use WASM — WebGPU is broken in onnxruntime-web 1.26.0-dev
    // (webgpuInit is not a function). WASM is universally supported.
    console.log('[yolos-detector] Loading on wasm (WebGPU disabled due to onnxruntime-web dev build bug)')

    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const pipe = await pipeline('object-detection', YOLOS_TINY.id, {
          revision: YOLOS_TINY.revision,
          device: 'wasm',
          dtype: 'q8',
        } as any) as unknown as DetectionPipeline
        console.log(`[yolos-detector] Loaded on wasm (attempt ${attempt})`)
        return pipe
      } catch (err) {
        lastError = err
        console.warn(`[yolos-detector] Attempt ${attempt} failed:`, err instanceof Error ? err.message : err)
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }
    }

    throw lastError instanceof Error
      ? new Error(`YOLOS-tiny failed after 3 attempts: ${lastError.message}`)
      : new Error('YOLOS-tiny failed after 3 attempts')
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
