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
 * Falls back to WASM (universally supported).
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

export async function loadYolosDetector(): Promise<DetectionPipeline> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true

    // FPS Optimization: Use WebGPU when available (5-10× faster than WASM)
    const device = await detectBestDevice()

    try {
      const pipe = await pipeline('object-detection', YOLOS_TINY.id, {
        revision: YOLOS_TINY.revision,
        device,
        dtype: 'q8',
      } as any) as unknown as DetectionPipeline
      console.log(`[yolos-detector] Loaded on ${device} (revision ${YOLOS_TINY.revision.slice(0, 8)})`)
      return pipe
    } catch (err) {
      // If WebGPU failed, fall back to WASM
      if (device === 'webgpu') {
        console.warn(`[yolos-detector] WebGPU failed, falling back to WASM:`, err)
        const pipe = await pipeline('object-detection', YOLOS_TINY.id, {
          revision: YOLOS_TINY.revision,
          device: 'wasm',
          dtype: 'q8',
        } as any) as unknown as DetectionPipeline
        console.log(`[yolos-detector] Loaded on wasm (fallback)`)
        return pipe
      }
      throw err
    }
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
