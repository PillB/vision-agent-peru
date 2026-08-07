/**
 * Model Selector Registry — Vision Agent Peru
 *
 * Maps each use case to a list of COMPATIBLE models the user can select from.
 * Each model entry includes pros/cons, size, speed, and resource requirements.
 *
 * The user can select any subset (at least 1) via a dropdown in the UI.
 * The detection pipeline adapts to the selected models at runtime.
 */

export type ModelTask = 'object-detection' | 'image-classification' | 'zero-shot-image-classification' | 'segmentation' | 'pose-estimation' | 'pixel-anomaly'
export type ModelBackend = 'webgpu' | 'wasm' | 'tfjs-webgl'

export interface ModelOption {
  id: string
  label: string
  modelId: string
  /** Pinned HuggingFace revision hash (D11 fix). When the model author pushes
   * a new commit, the hash changes and we get a deterministic, reproducible
   * download — no silent model drift. Use 'main' only for models that are
   * truly immutable (rare). */
  revision?: string
  task: ModelTask
  sizeMB: number
  license: string
  producesBboxes: boolean
  browserReady: boolean
  inferenceSpeed: 'fast' | 'medium' | 'slow'
  pros: string[]
  cons: string[]
  notes: string
  /** D9 fix: Whether the runtime adapter actually loads + runs this model.
   * The registry lists ALL candidate models for the UI selector, but only
   * some have adapters in specialized-models.ts. Models with
   * adapterImplemented=false are displayed but cannot be activated —
   * prevents the "user selects YOLOv10n, nothing happens" bug. */
  adapterImplemented?: boolean
}

// ─── ALL AVAILABLE MODELS ──────────────────────────────────────
export const ALL_MODELS: ModelOption[] = [
  // ─── Person/Vehicle Detectors ───
  {
    id: 'coco-ssd',
    label: 'COCO-SSD (TF.js)',
    modelId: '@tensorflow-models/coco-ssd',
    revision: 'npm:@tensorflow-models/coco-ssd@2.2.3;remote-model-unhashed',
    task: 'object-detection',
    sizeMB: 27,
    license: 'Apache-2.0',
    producesBboxes: true,
    browserReady: true,
    inferenceSpeed: 'slow',
    pros: ['80 COCO classes', 'Apache-2.0 license', 'TF.js native (no ONNX needed)'],
    cons: ['27MB — largest detector', '~3-5s per inference on WASM', 'Less accurate than YOLO on small objects'],
    notes: 'Experimental baseline. Runtime package is locked, but the remote graph files are not yet content-hash verified.',
    adapterImplemented: true,
  },
  {
    id: 'yolov10n',
    label: 'YOLOv10-nano (ONNX)',
    modelId: 'onnx-community/yolov10n',
    revision: 'unverified-candidate',
    task: 'object-detection',
    sizeMB: 2.53,
    license: 'AGPL-3.0',
    producesBboxes: true,
    browserReady: false,
    inferenceSpeed: 'fast',
    pros: ['2.5MB — 10× smaller than COCO-SSD', '80 COCO classes', 'Officially tagged transformers.js'],
    cons: ['AGPL-3.0 license (requires source disclosure)', 'Needs WebGPU for best speed'],
    notes: 'Best browser-ready detector. 10× smaller and faster than COCO-SSD. NOTE: adapter pending — selection is informational only.',
    adapterImplemented: false,
  },
  {
    id: 'yolos-tiny',
    label: 'YOLOS-tiny (ONNX)',
    modelId: 'Xenova/yolos-tiny',
    revision: '1a00cc14a139ff40bac9aa00c745915cb7b5b751',
    task: 'object-detection',
    sizeMB: 7.12,
    license: 'Apache-2.0',
    producesBboxes: true,
    browserReady: false,
    inferenceSpeed: 'medium',
    pros: ['Apache-2.0 (commercial-safe)', '7MB — 4× smaller than COCO-SSD', 'transformers.js native'],
    cons: ['Less accurate than YOLOv10', 'Slower inference than YOLO'],
    notes: 'Best Apache-licensed option. Good fallback if AGPL is unacceptable. NOTE: adapter pending — selection is informational only.',
    adapterImplemented: false,
  },

  // ─── Fire/Smoke Detectors ───
  {
    id: 'fire-vit',
    label: 'Fire Detection ViT',
    modelId: 'prithivMLmods/Fire-Detection-Engine-ONNX',
    revision: 'unverified-candidate',
    task: 'image-classification',
    sizeMB: 50,
    license: 'Apache-2.0',
    producesBboxes: false,
    browserReady: false,
    inferenceSpeed: 'medium',
    pros: ['Dedicated fire/smoke model', '3-class output (Fire/Normal/Smoky)', 'Apache-2.0'],
    cons: ['50MB download', 'Whole-frame classification only — no localization', 'Cannot show WHERE the fire is'],
    notes: 'Current fire detector. Classifies entire frame, no bounding boxes.',
    adapterImplemented: false,
  },
  {
    id: 'clip-fire',
    label: 'CLIP zero-shot (Fire)',
    modelId: 'Xenova/clip-vit-base-patch32',
    revision: '91f7a4bfa256ca85b019500008a355e2da0fe641',
    task: 'zero-shot-image-classification',
    sizeMB: 153,
    license: 'Apache-2.0',
    producesBboxes: false,
    browserReady: true,
    inferenceSpeed: 'slow',
    pros: ['Flexible — custom text prompts', 'Can distinguish fire/smoke/sunset/red objects'],
    cons: ['153MB — very large', 'No localization', 'Slower than dedicated models'],
    notes: 'Shared CLIP model configured with fire-specific prompts. Part of multi-model ensemble.',
    adapterImplemented: true,
  },

  // ─── Segmentation ───
  {
    id: 'segformer-b0',
    label: 'SegFormer-B0 (Water/Flood)',
    modelId: 'Xenova/segformer-b0-finetuned-ade-512-512',
    revision: 'unverified-candidate',
    task: 'segmentation',
    sizeMB: 4.21,
    license: 'Apache-2.0',
    producesBboxes: false,
    browserReady: false,
    inferenceSpeed: 'fast',
    pros: ['4.2MB — 36× smaller than CLIP', 'True pixel-level water segmentation', '150 ADE20K classes incl. water/sea/river/lake'],
    cons: ['Segmentation masks need post-processing to extract bbox', 'ADE20K classes are broad (not flood-specific)'],
    notes: 'Massive upgrade over CLIP for flood detection. Produces actual water pixel masks. NOTE: adapter pending — selection is informational only.',
    adapterImplemented: false,
  },

  // ─── Pose Estimation ───
  {
    id: 'yolov8n-pose',
    label: 'YOLOv8n-Pose (Fall detection)',
    modelId: 'Xenova/yolov8n-pose',
    revision: 'unverified-candidate',
    task: 'pose-estimation',
    sizeMB: 3.58,
    license: 'AGPL-3.0',
    producesBboxes: true,
    browserReady: false,
    inferenceSpeed: 'fast',
    pros: ['3.6MB — 43× smaller than CLIP', '17 body keypoints (nose to ankles)', 'Actual fall detection via kinematics'],
    cons: ['AGPL-3.0 license', 'Needs WebGPU for realtime', 'Fall detection logic must be implemented separately'],
    notes: 'Enables real fall detection by analyzing body keypoint verticality. Replaces CLIP guessing. NOTE: adapter pending — selection is informational only.',
    adapterImplemented: false,
  },

  // ─── Pixel Anomaly (always available, no download) ───
  {
    id: 'pixel-anomaly',
    label: 'Pixel Anomaly (HSV + Frame-diff)',
    modelId: 'builtin',
    revision: 'builtin-v1',
    task: 'pixel-anomaly',
    sizeMB: 0,
    license: 'MIT',
    producesBboxes: true,
    browserReady: true,
    inferenceSpeed: 'fast',
    pros: ['Zero download — runs instantly', 'No ML model needed', 'Detects fire (red pixels), flood (blue), cracks (dark)', 'Always available as fallback'],
    cons: ['Less accurate than ML models', 'Cannot distinguish fire from sunset/red objects', 'Simple color heuristic'],
    notes: 'Built-in heuristic detector. Always runs as supplementary signal in the ensemble.',
    adapterImplemented: true,
  },

  // ─── CLIP Zero-Shot (shared) ───
  {
    id: 'clip-zero-shot',
    label: 'CLIP Zero-Shot (Multi-use)',
    modelId: 'Xenova/clip-vit-base-patch32',
    revision: '91f7a4bfa256ca85b019500008a355e2da0fe641',
    task: 'zero-shot-image-classification',
    sizeMB: 153,
    license: 'Apache-2.0',
    producesBboxes: false,
    browserReady: true,
    inferenceSpeed: 'slow',
    pros: ['Universal — works for ANY visual task via text prompts', 'Can detect graffiti, flood, landslide, crack, slip', 'Loaded once, shared across use cases'],
    cons: ['153MB — very large', 'No localization (whole-frame only)', 'Scores are relative, not calibrated'],
    notes: 'Universal fallback for use cases without dedicated models. Shared cache across graffiti/flood/landslide/crack/slip.',
    adapterImplemented: true,
  },
]

// ─── USE CASE TO COMPATIBLE MODELS MAPPING ─────────────────────
export const USE_CASE_MODELS: Record<string, string[]> = {
  intrusion:           ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  after_hours:         ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  crowd_surge:         ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  parking:             ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  queue_anomaly:       ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  abandoned_object:    ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  graffiti:            ['clip-zero-shot', 'pixel-anomaly'],
  fire_smoke:          ['fire-vit', 'clip-fire', 'pixel-anomaly'],
  slip_hazard:         ['yolov8n-pose', 'clip-zero-shot', 'pixel-anomaly'],
  incident_description: ['coco-ssd', 'yolov10n', 'yolos-tiny'],
  auto_report:         ['coco-ssd', 'yolov10n', 'yolos-tiny', 'pixel-anomaly'],
  visual_memory:       ['coco-ssd', 'yolov10n', 'yolos-tiny'],
  flood_watch:         ['segformer-b0', 'clip-zero-shot', 'pixel-anomaly'],
  landslide_watch:     ['clip-zero-shot', 'pixel-anomaly'],
  post_quake:          ['clip-zero-shot', 'pixel-anomaly'],
}

// ─── DEFAULT MODEL PER USE CASE ────────────────────────────────
export const DEFAULT_MODELS: Record<string, string> = {
  intrusion:           'coco-ssd',
  after_hours:         'coco-ssd',
  crowd_surge:         'coco-ssd',
  parking:             'coco-ssd',
  queue_anomaly:       'coco-ssd',
  abandoned_object:    'coco-ssd',
  graffiti:            'clip-zero-shot',
  fire_smoke:          'pixel-anomaly',
  slip_hazard:         'clip-zero-shot',
  incident_description: 'coco-ssd',
  auto_report:         'coco-ssd',
  visual_memory:       'coco-ssd',
  flood_watch:         'clip-zero-shot',
  landslide_watch:     'clip-zero-shot',
  post_quake:          'clip-zero-shot',
}

/**
 * Get all compatible models for a use case, SORTED best-to-worst.
 * Ranking criteria:
 *   1. Browser-ready models first (ready > pending)
 *   2. Smaller size = better (faster download + inference)
 *   3. Faster inference speed = better
 *   4. Produces bboxes = better (localization > whole-frame)
 *   5. Better license (Apache > MIT > AGPL > unknown)
 *
 * D10 fix: License matching is now CASE-INSENSITIVE (was 'apache-2.0' but
 * stored as 'Apache-2.0' → every license got rank 9 → license tie-breaker
 * never fired). Also handle zero-size (builtin pixel-anomaly) explicitly
 * so it does NOT beat every real model solely on size — it's a fallback,
 * not a primary detector.
 */
export function getCompatibleModels(useCaseId: string): ModelOption[] {
  const modelIds = USE_CASE_MODELS[useCaseId] || []
  const models = modelIds
    .map(id => ALL_MODELS.find(m => m.id === id))
    .filter((m): m is ModelOption => m !== undefined)

  const speedRank: Record<string, number> = { fast: 0, medium: 1, slow: 2 }
  // Case-insensitive license ranking — fix for D10.
  const licenseRank: Record<string, number> = {
    'apache-2.0': 0,
    'mit': 1,
    'agpl-3.0': 2,
    'unknown': 3,
  }
  const getLicenseRank = (license: string): number => {
    const key = (license || '').toLowerCase().trim()
    return licenseRank[key] ?? 9
  }
  // Builtin pixel-anomaly is size=0 but is a FALLBACK, not a primary model.
  // Rank it last by treating its size as Infinity for sort purposes.
  const effectiveSize = (m: ModelOption): number => m.modelId === 'builtin' ? Infinity : m.sizeMB

  return models.sort((a, b) => {
    // 1. A functioning adapter is required before benchmark ranking.
    if (a.adapterImplemented !== b.adapterImplemented) return a.adapterImplemented ? -1 : 1
    // 2. Browser-ready first
    if (a.browserReady !== b.browserReady) return a.browserReady ? -1 : 1
    // 2. Smaller size first (builtin = Infinity, so it ranks last)
    const sa = effectiveSize(a), sb = effectiveSize(b)
    if (sa !== sb) return sa - sb
    // 3. Faster speed first
    const speedDiff = (speedRank[a.inferenceSpeed] ?? 9) - (speedRank[b.inferenceSpeed] ?? 9)
    if (speedDiff !== 0) return speedDiff
    // 4. Produces bboxes first
    if (a.producesBboxes !== b.producesBboxes) return a.producesBboxes ? -1 : 1
    // 5. Better license first (case-insensitive)
    return getLicenseRank(a.license) - getLicenseRank(b.license)
  })
}

/**
 * Get the default model for a use case.
 */
export function getDefaultModel(useCaseId: string): ModelOption | null {
  const id = DEFAULT_MODELS[useCaseId]
  return ALL_MODELS.find(m => m.id === id) || null
}

/**
 * Get a model by ID.
 */
export function getModelById(modelId: string): ModelOption | null {
  return ALL_MODELS.find(m => m.id === modelId) || null
}
