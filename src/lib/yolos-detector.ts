import type { DetectionAdapter } from './video-indexer'

export const YOLOS_TINY = {
  id: 'Xenova/yolos-tiny',
  revision: '1a00cc14a139ff40bac9aa00c745915cb7b5b751',
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

export async function loadYolosDetector(): Promise<DetectionPipeline> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    return await pipeline('object-detection', YOLOS_TINY.id, {
      revision: YOLOS_TINY.revision,
      device: 'wasm',
      dtype: 'q8',
    } as any) as unknown as DetectionPipeline
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
