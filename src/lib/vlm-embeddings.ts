export const RETRIEVAL_MODEL = {
  id: 'Xenova/clip-vit-base-patch32',
  revision: '91f7a4bfa256ca85b019500008a355e2da0fe641',
  license: 'Apache-2.0',
  dimensions: 512,
  status: 'experimental' as const,
  limitation: 'Similarity is not a probability. Surveillance-domain quality and open-set thresholds are not yet validated.',
}

type ClipRuntime = {
  tokenizer: any
  processor: any
  textModel: any
  visionModel: any
  backend: 'wasm' | 'webgpu'
}

let runtimePromise: Promise<ClipRuntime> | null = null

function normalize(values: ArrayLike<number>): Float32Array {
  const output = Float32Array.from(values)
  let sum = 0
  for (const value of output) sum += value * value
  const norm = Math.sqrt(sum)
  if (norm === 0) return output
  for (let index = 0; index < output.length; index++) output[index] /= norm
  return output
}

export async function loadClipRuntime(preferWebGpu = false): Promise<ClipRuntime> {
  if (runtimePromise) return runtimePromise
  runtimePromise = (async () => {
    const {
      AutoProcessor,
      AutoTokenizer,
      CLIPTextModelWithProjection,
      CLIPVisionModelWithProjection,
      env,
    } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true

    const gpu = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { gpu?: unknown }).gpu
    const hasWebGpu = preferWebGpu && Boolean(gpu)
    const backend: 'wasm' | 'webgpu' = hasWebGpu ? 'webgpu' : 'wasm'
    const options = {
      revision: RETRIEVAL_MODEL.revision,
      device: backend,
      dtype: 'q8',
    } as any
    const [tokenizer, processor, textModel, visionModel] = await Promise.all([
      AutoTokenizer.from_pretrained(RETRIEVAL_MODEL.id, { revision: RETRIEVAL_MODEL.revision }),
      AutoProcessor.from_pretrained(RETRIEVAL_MODEL.id, { revision: RETRIEVAL_MODEL.revision }),
      CLIPTextModelWithProjection.from_pretrained(RETRIEVAL_MODEL.id, options),
      CLIPVisionModelWithProjection.from_pretrained(RETRIEVAL_MODEL.id, options),
    ])
    return { tokenizer, processor, textModel, visionModel, backend }
  })().catch(error => {
    runtimePromise = null
    throw error
  })
  return runtimePromise
}

export async function embedText(text: string): Promise<Float32Array> {
  const runtime = await loadClipRuntime()
  const input = runtime.tokenizer([text], { padding: true, truncation: true })
  const { text_embeds } = await runtime.textModel(input)
  return normalize(text_embeds.data)
}

export async function embedImageCanvas(canvas: HTMLCanvasElement): Promise<Float32Array> {
  const runtime = await loadClipRuntime()
  const { RawImage } = await import('@huggingface/transformers')
  const image = RawImage.fromCanvas(canvas)
  const input = await runtime.processor(image)
  const { image_embeds } = await runtime.visionModel(input)
  return normalize(image_embeds.data)
}

export function resetClipRuntime(): void {
  runtimePromise = null
}
