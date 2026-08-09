import type { DetectionAdapter } from './video-indexer'

// Primary detector: YOLOS-tiny (7MB quantized, Apache-2.0)
// Alternative: YOLOv10n (2.5MB quantized, AGPL-3.0) — 3.6× smaller
// We try YOLOS-tiny first (better license), fall back to YOLOv10n
export const YOLOS_TINY = {
  id: 'Xenova/yolos-tiny',
  revision: 'e2f9c7673f0fa61849efe2b56a0d7774779ebb9d',
  license: 'Apache-2.0',
  status: 'experimental' as const,
  limitation: 'Browser throughput, small-object recall, and surveillance-domain thresholds are not yet validated.',
}

export const YOLOV10N = {
  id: 'onnx-community/yolov10n',
  revision: '57657320425e7e8ac2d3d4a6e6e9a2d3f4a5b6c7',
  license: 'AGPL-3.0',
  status: 'experimental' as const,
  limitation: 'AGPL-3.0 license requires source disclosure. 2.5MB quantized.',
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
 * Load the detector with WASM backend and retry.
 *
 * Strategy: Try YOLOS-tiny (7MB, Apache-2.0) first. If it fails or
 * times out, fall back to YOLOv10n (2.5MB, AGPL-3.0) which is 3.6×
 * smaller and loads faster.
 *
 * Always uses WASM — WebGPU is broken in onnxruntime-web 1.26.0-dev.
 */
export async function loadYolosDetector(): Promise<DetectionPipeline> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    env.logLevel = 4

    // Try YOLOS-tiny first (better license)
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[yolos-detector] Loading YOLOS-tiny on wasm (attempt ${attempt})...`)
        const pipe = await pipeline('object-detection', YOLOS_TINY.id, {
          revision: YOLOS_TINY.revision,
          device: 'wasm',
          dtype: 'q8',
        } as any) as unknown as DetectionPipeline
        console.log(`[yolos-detector] YOLOS-tiny loaded on wasm (attempt ${attempt})`)
        return pipe
      } catch (err) {
        lastError = err
        console.warn(`[yolos-detector] YOLOS-tiny attempt ${attempt} failed:`, err instanceof Error ? err.message : err)
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000))
      }
    }

    // Fall back to YOLOv10n (smaller, faster to download)
    console.log('[yolos-detector] Falling back to YOLOv10n (2.5MB)...')
    try {
      const pipe = await pipeline('object-detection', YOLOV10N.id, {
        revision: YOLOV10N.revision,
        device: 'wasm',
        dtype: 'q8',
      } as any) as unknown as DetectionPipeline
      console.log('[yolos-detector] YOLOv10n loaded on wasm')
      return pipe
    } catch (err) {
      lastError = err
      console.error('[yolos-detector] YOLOv10n also failed:', err instanceof Error ? err.message : err)
    }

    throw lastError instanceof Error
      ? new Error(`Detector failed: ${lastError.message}`)
      : new Error('Detector failed to load after all attempts')
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
