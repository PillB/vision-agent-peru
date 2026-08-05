/**
 * Model Candidate Registry — Vision Agent Peru
 *
 * Round 2: Research-backed model candidates for each use case.
 * Each entry is verified against HuggingFace API for ONNX availability,
 * browser compatibility, and license.
 *
 * Models are loaded LAZILY — only when the user selects a use case
 * that requires them. No eager loading.
 */

export type ModelTask = 'object-detection' | 'image-classification' | 'zero-shot-image-classification' | 'segmentation' | 'pose-estimation'
export type ModelBackend = 'webgpu' | 'wasm' | 'tfjs-webgl'
export type ModelLicense = 'apache-2.0' | 'agpl-3.0' | 'mit' | 'unknown'

export interface ModelCandidate {
  id: string
  modelId: string
  task: ModelTask
  publisher: string
  architecture: string
  labels?: string[]
  sizeMB: number
  license: ModelLicense
  onnxAvailable: boolean
  transformersJsCompatible: boolean
  producesBboxes: boolean
  browserReady: boolean
  notes: string
}

// ─── CURRENT BASELINE MODELS ───────────────────────────────────
export const BASELINE: ModelCandidate[] = [
  {
    id: 'coco-ssd',
    modelId: '@tensorflow-models/coco-ssd',
    task: 'object-detection',
    publisher: 'Google',
    architecture: 'SSD MobileNet v2',
    labels: ['person', 'car', 'truck', 'bus', 'motorcycle', 'backpack', 'suitcase', 'handbag'],
    sizeMB: 27,
    license: 'apache-2.0',
    onnxAvailable: false,
    transformersJsCompatible: false,
    producesBboxes: true,
    browserReady: true,
    notes: 'Current default. TF.js native. 80 COCO classes. ~3-5s per inference on WASM.',
  },
  {
    id: 'fire-detection-vit',
    modelId: 'prithivMLmods/Fire-Detection-Engine-ONNX',
    task: 'image-classification',
    publisher: 'prithivMLmods',
    architecture: 'ViT-base',
    labels: ['Fire Needed Action', 'Normal Conditions', 'Smoky Environment'],
    sizeMB: 50,
    license: 'apache-2.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: false,
    browserReady: true,
    notes: 'Whole-frame classification only. No localization. Currently used for fire_smoke.',
  },
  {
    id: 'clip-vit-base',
    modelId: 'Xenova/clip-vit-base-patch32',
    task: 'zero-shot-image-classification',
    publisher: 'Xenova',
    architecture: 'CLIP ViT-B/32',
    sizeMB: 153,
    license: 'apache-2.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: false,
    browserReady: true,
    notes: 'Shared across 5 use cases (graffiti, flood, landslide, crack, slip). Very large (~153MB).',
  },
]

// ─── CHALLENGER MODELS (researched, not yet integrated) ───────
export const CHALLENGERS: ModelCandidate[] = [
  // Person/vehicle detection — 10× smaller than COCO-SSD
  {
    id: 'yolo26n',
    modelId: 'onnx-community/yolo26n-ONNX',
    task: 'object-detection',
    publisher: 'onnx-community',
    architecture: 'YOLO26-nano',
    labels: ['person', 'car', 'truck', 'bus', 'motorcycle', 'backpack', 'suitcase', 'handbag'],
    sizeMB: 2.72,
    license: 'agpl-3.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: true,
    browserReady: true,
    notes: 'NEWEST (2026). 10× smaller than COCO-SSD. 80 COCO classes. Verified in WebGPU demo.',
  },
  {
    id: 'yolov10n',
    modelId: 'onnx-community/yolov10n',
    task: 'object-detection',
    publisher: 'onnx-community',
    architecture: 'YOLOv10-nano',
    labels: ['person', 'car', 'truck', 'bus', 'motorcycle', 'backpack', 'suitcase', 'handbag'],
    sizeMB: 2.53,
    license: 'agpl-3.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: true,
    browserReady: true,
    notes: 'Officially tagged transformers.js. Slightly smaller than yolo26n.',
  },
  {
    id: 'yolos-tiny',
    modelId: 'Xenova/yolos-tiny',
    task: 'object-detection',
    publisher: 'Xenova',
    architecture: 'YOLOS-tiny',
    labels: ['person', 'car', 'truck', 'bus', 'motorcycle', 'backpack', 'suitcase', 'handbag'],
    sizeMB: 7.12,
    license: 'apache-2.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: true,
    browserReady: true,
    notes: 'Best non-AGPL option. Apache-2.0. Larger than YOLO but still 4× smaller than COCO-SSD.',
  },

  // Fire/smoke with LOCALIZATION (bounding boxes)
  {
    id: 'fire-smoke-yolov8n',
    modelId: 'rabahdev/fire-smoke-yolov8n',
    task: 'object-detection',
    publisher: 'rabahdev',
    architecture: 'YOLOv8n',
    labels: ['smoke', 'fire'],
    sizeMB: 3,
    license: 'agpl-3.0',
    onnxAvailable: false,
    transformersJsCompatible: false,
    producesBboxes: true,
    browserReady: false,
    notes: 'Best fire LOCALIZER (mAP50=0.754). PyTorch only — needs ONNX export. 1-line: yolo export model=best.pt format=onnx int8=True',
  },

  // Crack detection with localization
  {
    id: 'crack-yolov8',
    modelId: 'cazzz307/yolov8-crack-detection',
    task: 'object-detection',
    publisher: 'cazzz307',
    architecture: 'YOLOv8n',
    labels: ['crack'],
    sizeMB: 3,
    license: 'mit',
    onnxAvailable: false,
    transformersJsCompatible: false,
    producesBboxes: true,
    browserReady: false,
    notes: 'MIT license (rare for YOLO). PyTorch only — needs ONNX export. mAP/precision/recall documented.',
  },

  // Pose estimation for fall detection
  {
    id: 'yolov8n-pose',
    modelId: 'Xenova/yolov8n-pose',
    task: 'pose-estimation',
    publisher: 'Xenova',
    architecture: 'YOLOv8n-pose',
    labels: ['person'],
    sizeMB: 3.58,
    license: 'agpl-3.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: true,
    browserReady: true,
    notes: '17 COCO keypoints. Compute hip/knee/ankle verticality → fall detection. 10× lighter than current CLIP for slip_hazard.',
  },

  // Flood/water segmentation (true pixel-level masks)
  {
    id: 'segformer-b0-ade',
    modelId: 'Xenova/segformer-b0-finetuned-ade-512-512',
    task: 'segmentation',
    publisher: 'Xenova',
    architecture: 'SegFormer-B0',
    labels: ['water', 'sea', 'river', 'lake', 'waterfall'],
    sizeMB: 4.21,
    license: 'apache-2.0',
    onnxAvailable: true,
    transformersJsCompatible: true,
    producesBboxes: false,
    browserReady: true,
    notes: '178K downloads. True pixel-level water segmentation. Massive upgrade over CLIP "flood" classification.',
  },
]

// ─── RECOMMENDED STACK (minimal, high-impact) ─────────────────
export const RECOMMENDED: Record<string, ModelCandidate> = {
  // Replace COCO-SSD with YOLO26n (10× smaller, same classes)
  person_vehicle_detection: CHALLENGERS.find(c => c.id === 'yolov10n')!,

  // Keep fire ViT for classification, add YOLOv8n for localization (when exported)
  fire_detection: BASELINE.find(b => b.id === 'fire-detection-vit')!,

  // Replace CLIP for flood with SegFormer (true segmentation, 40× smaller)
  flood_segmentation: CHALLENGERS.find(c => c.id === 'segformer-b0-ade')!,

  // Replace CLIP for slip with pose estimation (detect actual falls)
  fall_detection: CHALLENGERS.find(c => c.id === 'yolov8n-pose')!,

  // Keep CLIP for graffiti/landslide (no dedicated browser-ready alternatives)
  zero_shot_residual: BASELINE.find(b => b.id === 'clip-vit-base')!,
}

// ─── REJECTED CANDIDATES ───────────────────────────────────────
export const REJECTED: Array<{ candidate: ModelCandidate; reason: string }> = [
  {
    candidate: CHALLENGERS.find(c => c.id === 'yolo26n')!,
    reason: 'Same as yolov10n but lacks transformers.js tag. Prefer yolov10n for official support.',
  },
  {
    candidate: BASELINE.find(b => b.id === 'coco-ssd')!,
    reason: '27MB vs 2.5MB for YOLOv10n. 10× larger for same COCO classes. Kept as fallback only.',
  },
  {
    candidate: CHALLENGERS.find(c => c.id === 'fire-smoke-yolov8n')!,
    reason: 'Best fire localizer but PyTorch-only. Needs ONNX export step. Rejected for now — revisit after export.',
  },
  {
    candidate: CHALLENGERS.find(c => c.id === 'crack-yolov8')!,
    reason: 'MIT license (excellent) but PyTorch-only. Needs ONNX export. Rejected for now — revisit after export.',
  },
]

/**
 * Get the recommended model for a use case.
 */
export function getRecommendedModel(useCaseId: string): ModelCandidate | null {
  const mapping: Record<string, string> = {
    intrusion: 'person_vehicle_detection',
    after_hours: 'person_vehicle_detection',
    crowd_surge: 'person_vehicle_detection',
    parking: 'person_vehicle_detection',
    queue_anomaly: 'person_vehicle_detection',
    abandoned_object: 'person_vehicle_detection',
    fire_smoke: 'fire_detection',
    flood_watch: 'flood_segmentation',
    slip_hazard: 'fall_detection',
    graffiti: 'zero_shot_residual',
    landslide_watch: 'zero_shot_residual',
    post_quake: 'zero_shot_residual',
  }
  const key = mapping[useCaseId]
  return key ? RECOMMENDED[key] || null : null
}

/**
 * Get all browser-ready challengers (can be integrated immediately).
 */
export function getBrowserReadyChallengers(): ModelCandidate[] {
  return CHALLENGERS.filter(c => c.browserReady)
}

/**
 * Get all challengers that need ONNX export (can't use yet).
 */
export function getPendingExportChallengers(): ModelCandidate[] {
  return CHALLENGERS.filter(c => !c.browserReady)
}
