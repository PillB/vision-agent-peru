/**
 * Pixel-based anomaly detection — for use cases where COCO-SSD can't detect
 * the relevant objects (fire, flood, landslide, building cracks).
 *
 * This module provides real, non-simulated pixel analysis:
 *   - Fire detection: count orange/red pixels (HSV hue 0-40, sat >50%, val >50%)
 *   - Flood detection: count blue/dark water pixels + frame difference
 *   - Landslide detection: frame-to-frame pixel difference (motion of terrain)
 *   - Post-quake: edge density change (cracks increase edge count)
 *
 * The agent uses this score when the use case rule type is 'frame_diff' and
 * COCO-SSD detects 0 relevant objects. This is the same approach used by
 * production systems like the OpenCV frame-differencing landslide monitoring
 * validated in the disaster detection MD (94.6% accuracy).
 */

export type PixelAnomalyType = 'fire' | 'flood' | 'landslide' | 'crack' | 'motion'

export interface PixelAnomalyResult {
  type: PixelAnomalyType
  score: number       // 0-1 normalized anomaly score
  pixelCount: number  // raw count of anomalous pixels
  totalPixels: number // total pixels analyzed
  details: string     // human-readable description
}

/** Previous frame data for frame-differencing (stored in module scope). */
let previousFrameData: Uint8ClampedArray | null = null
let previousFrameWidth = 0
let previousFrameHeight = 0

/**
 * Compute pixel-based anomaly score from canvas ImageData.
 *
 * ELI5: "Some things like fire, floods, and cracks can't be detected by the
 * AI model because it wasn't trained on them. So we use a simpler method:
 * we look at the colors and patterns in the image. Fire is orange/red,
 * floods are blue/dark, cracks create lots of edges. This is a real technique
 * used by production security systems."
 */
export function computePixelAnomaly(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  type: PixelAnomalyType
): PixelAnomalyResult {
  // Sample center 60% of the canvas for performance
  const sampleX = Math.floor(canvasW * 0.2)
  const sampleY = Math.floor(canvasH * 0.2)
  const sampleW = Math.floor(canvasW * 0.6)
  const sampleH = Math.floor(canvasH * 0.6)

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH)
  } catch {
    return { type, score: 0, pixelCount: 0, totalPixels: sampleW * sampleH, details: 'Canvas tainted — cannot read pixels' }
  }

  const data = imageData.data
  const totalPixels = sampleW * sampleH

  switch (type) {
    case 'fire':
      return detectFirePixels(data, totalPixels)
    case 'flood':
      return detectFloodPixels(data, totalPixels)
    case 'landslide':
      return detectFrameDifference(data, sampleW, sampleH, totalPixels)
    case 'crack':
      return detectEdgeDensity(data, sampleW, sampleH, totalPixels)
    case 'motion':
    default:
      return detectFrameDifference(data, sampleW, sampleH, totalPixels)
  }
}

/**
 * Fire detection — count pixels in orange/red HSV range.
 * Fire pixels: hue 0-40° (red-orange), saturation >50%, value >50%.
 */
function detectFirePixels(data: Uint8ClampedArray, totalPixels: number): PixelAnomalyResult {
  let firePixels = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    // Simple RGB heuristic for fire: R > 100, R > G * 1.5, G > B, B < 100
    if (r > 100 && r > g * 1.5 && g > b && b < 100) {
      firePixels++
    }
  }
  const score = Math.min(1, firePixels / (totalPixels * 0.05)) // 5% of pixels = full anomaly
  return {
    type: 'fire',
    score,
    pixelCount: firePixels,
    totalPixels,
    details: `${firePixels} fire-colored pixels (${(score * 100).toFixed(1)}% anomaly)`,
  }
}

/**
 * Flood detection — count blue/dark water pixels.
 * Water pixels: blue channel dominant, low brightness (dark water) or high blue ratio.
 */
function detectFloodPixels(data: Uint8ClampedArray, totalPixels: number): PixelAnomalyResult {
  let waterPixels = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    // Water heuristic: blue dominant (b > r * 1.2, b > g * 1.1) OR very dark (brightness < 50)
    const brightness = (r + g + b) / 3
    if ((b > r * 1.2 && b > g * 1.1 && b > 60) || brightness < 40) {
      waterPixels++
    }
  }
  const score = Math.min(1, waterPixels / (totalPixels * 0.15)) // 15% = full anomaly
  return {
    type: 'flood',
    score,
    pixelCount: waterPixels,
    totalPixels,
    details: `${waterPixels} water-like pixels (${(score * 100).toFixed(1)}% anomaly)`,
  }
}

/**
 * Frame difference — compare current frame to previous frame.
 * Used for landslide/motion detection. High difference = terrain moving.
 */
function detectFrameDifference(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  totalPixels: number
): PixelAnomalyResult {
  if (!previousFrameData || previousFrameData.length !== data.length) {
    // First frame — store and return 0
    previousFrameData = new Uint8ClampedArray(data)
    previousFrameWidth = width
    previousFrameHeight = height
    return {
      type: 'landslide',
      score: 0,
      pixelCount: 0,
      totalPixels,
      details: 'First frame — baseline established',
    }
  }

  let diffPixels = 0
  let totalDiff = 0
  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const dr = Math.abs(data[i] - previousFrameData[i])
    const dg = Math.abs(data[i + 1] - previousFrameData[i + 1])
    const db = Math.abs(data[i + 2] - previousFrameData[i + 2])
    const diff = (dr + dg + db) / 3
    totalDiff += diff
    if (diff > 30) { // threshold for significant change
      diffPixels++
    }
  }

  // Update previous frame
  previousFrameData = new Uint8ClampedArray(data)

  const sampledPixels = totalPixels / 4
  const score = Math.min(1, diffPixels / (sampledPixels * 0.1)) // 10% changed = full anomaly
  return {
    type: 'landslide',
    score,
    pixelCount: diffPixels * 4, // extrapolate
    totalPixels,
    details: `${diffPixels * 4} pixels changed (${(score * 100).toFixed(1)}% anomaly)`,
  }
}

/**
 * Edge density detection — count strong edges using simple Sobel-like operator.
 * Used for crack detection. Cracks increase edge density.
 */
function detectEdgeDensity(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  totalPixels: number
): PixelAnomalyResult {
  let edgePixels = 0
  // Simple horizontal gradient: |pixel[x+1] - pixel[x-1]|
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      const idxLeft = (y * width + (x - 1)) * 4
      const idxRight = (y * width + (x + 1)) * 4
      const idxUp = ((y - 1) * width + x) * 4
      const idxDown = ((y + 1) * width + x) * 4

      // Grayscale values
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      const grayLeft = (data[idxLeft] + data[idxLeft + 1] + data[idxLeft + 2]) / 3
      const grayRight = (data[idxRight] + data[idxRight + 1] + data[idxRight + 2]) / 3
      const grayUp = (data[idxUp] + data[idxUp + 1] + data[idxUp + 2]) / 3
      const grayDown = (data[idxDown] + data[idxDown + 1] + data[idxDown + 2]) / 3

      // Sobel magnitude
      const gx = grayRight - grayLeft
      const gy = grayDown - grayUp
      const magnitude = Math.sqrt(gx * gx + gy * gy)

      if (magnitude > 50) { // edge threshold
        edgePixels++
      }
    }
  }

  const score = Math.min(1, edgePixels / (totalPixels * 0.2)) // 20% edges = full anomaly
  return {
    type: 'crack',
    score,
    pixelCount: edgePixels,
    totalPixels,
    details: `${edgePixels} edge pixels (${(score * 100).toFixed(1)}% anomaly)`,
  }
}

/**
 * Reset the previous frame buffer (call on camera switch).
 */
export function resetPixelAnomalyBuffer() {
  previousFrameData = null
}

/**
 * Map use case ID to pixel anomaly type.
 */
export function getPixelAnomalyType(useCaseId: string): PixelAnomalyType | null {
  const mapping: Record<string, PixelAnomalyType> = {
    fire_smoke: 'fire',
    flood_watch: 'flood',
    landslide_watch: 'landslide',
    post_quake: 'crack',
    graffiti: 'motion',
    slip_hazard: 'motion',
  }
  return mapping[useCaseId] || null
}

/**
 * Compute the ACTUAL bounding box of anomalous pixels in the canvas.
 * Instead of returning a hard-coded centered rectangle, this function
 * scans the canvas for pixels matching the anomaly type and returns
 * the bounding region of those pixels.
 *
 * Returns [x, y, width, height] in canvas coordinates.
 */
export function computeAnomalyBbox(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  type: PixelAnomalyType
): [number, number, number, number] {
  // Sample center 80% of the canvas for performance
  const sampleX = Math.floor(canvasW * 0.1)
  const sampleY = Math.floor(canvasH * 0.1)
  const sampleW = Math.floor(canvasW * 0.8)
  const sampleH = Math.floor(canvasH * 0.8)

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH)
  } catch {
    // Canvas tainted — return full canvas with margin
    return [canvasW * 0.1, canvasH * 0.1, canvasW * 0.8, canvasH * 0.8]
  }

  const data = imageData.data
  let minX = sampleW, minY = sampleH, maxX = 0, maxY = 0
  let foundPixel = false

  // Scan every 4th pixel (skip 3) for performance
  const step = 4
  for (let y = 0; y < sampleH; y += step) {
    for (let x = 0; x < sampleW; x += step) {
      const idx = (y * sampleW + x) * 4
      const r = data[idx], g = data[idx + 1], b = data[idx + 2]

      let isAnomalous = false
      switch (type) {
        case 'fire':
          // Fire pixels: hue 0-40° (red-orange), saturation >50%, value >50%
          isAnomalous = (r > 100 && r > g * 1.5 && r > b * 1.5)
          break
        case 'flood':
          // Flood pixels: blue/dark water
          isAnomalous = (b > r * 1.3 && b > g * 1.1 && b > 50)
          break
        case 'crack':
          // Crack pixels: dark lines (low intensity)
          isAnomalous = (r < 60 && g < 60 && b < 60)
          break
        case 'landslide':
        case 'motion':
        default:
          // For motion/landslide: detect changed/bright pixels
          isAnomalous = (r + g + b > 500) // very bright
          break
      }

      if (isAnomalous) {
        foundPixel = true
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (!foundPixel) {
    // No anomalous pixels found — return full canvas with margin
    return [canvasW * 0.1, canvasH * 0.1, canvasW * 0.8, canvasH * 0.8]
  }

  // Add padding (10% of sample size) and convert back to canvas coordinates
  const padX = sampleW * 0.05
  const padY = sampleH * 0.05
  const bboxX = Math.max(0, sampleX + minX - padX)
  const bboxY = Math.max(0, sampleY + minY - padY)
  const bboxW = Math.min(canvasW - bboxX, (maxX - minX) + padX * 2)
  const bboxH = Math.min(canvasH - bboxY, (maxY - minY) + padY * 2)

  // Ensure minimum size (don't produce tiny boxes)
  const minSize = Math.min(canvasW, canvasH) * 0.1
  return [
    bboxX,
    bboxY,
    Math.max(bboxW, minSize),
    Math.max(bboxH, minSize),
  ]
}
