/**
 * Detection Web Worker — runs YOLOS-tiny/YOLOv10n inference off the main thread.
 *
 * This solves the core issue: WASM inference blocks the main thread for 8-12
 * seconds, freezing the UI. By moving inference to a Web Worker, the main
 * thread stays responsive for video playback, UI updates, and FPS counting.
 *
 * The worker:
 *   1. Loads the model via transformers.js pipeline (WASM backend)
 *   2. Receives canvas ImageBitmaps via postMessage
 *   3. Runs detection
 *   4. Returns detection results to the main thread
 *
 * Usage:
 *   const worker = new Worker(new URL('./detection-worker.ts', import.meta.url))
 *   worker.postMessage({ type: 'init', modelId, revision })
 *   worker.postMessage({ type: 'detect', image: bitmap })
 *   worker.onmessage = (e) => { ... }
 */

import { YOLOS_TINY } from './yolos-detector'

type DetectionResult = Array<{
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
}>

let pipeline: ((image: unknown, options: { threshold: number; percentage: boolean }) => Promise<DetectionResult>) | null = null
let isLoaded = false

async function loadModel() {
  if (pipeline) return
  const { env, pipeline: createPipeline, RawImage } = await import('@huggingface/transformers')
  env.allowLocalModels = false
  env.useBrowserCache = true
  env.logLevel = 4 // error only

  console.log('[detection-worker] Loading model on wasm...')
  pipeline = await createPipeline('object-detection', YOLOS_TINY.id, {
    revision: YOLOS_TINY.revision,
    device: 'wasm',
    dtype: 'q8',
  } as any) as unknown as typeof pipeline
  isLoaded = true
  console.log('[detection-worker] Model loaded')
  ;(self as any).postMessage({ type: 'ready' })
}

async function detect(imageBitmap: ImageBitmap) {
  if (!pipeline) {
    ;(self as any).postMessage({ type: 'error', error: 'Model not loaded' })
    return
  }

  try {
    const { RawImage } = await import('@huggingface/transformers')
    // Convert ImageBitmap to RawImage
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imageBitmap, 0, 0)
    const image = RawImage.fromCanvas(canvas)
    imageBitmap.close()

    const startTime = performance.now()
    const results = await pipeline(image, { threshold: 0.35, percentage: false })
    const latency = performance.now() - startTime

    ;(self as any).postMessage({
      type: 'result',
      detections: results.slice(0, 20).map(({ label, score, box }) => ({
        class: label,
        score,
        bbox: [box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin],
      })),
      latency,
    })
  } catch (err) {
    ;(self as any).postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : 'detection failed',
    })
  }
}

;(self as any).onmessage = async (e: MessageEvent) => {
  const { type, image } = e.data
  if (type === 'init') {
    await loadModel()
  } else if (type === 'detect') {
    if (!isLoaded) {
      // Auto-load if not loaded yet
      await loadModel()
    }
    await detect(image)
  }
}
