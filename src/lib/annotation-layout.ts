export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
  visible: boolean
}

export interface AnnotationRequest {
  anchor: [number, number, number, number]
  width: number
  height: number
  /** Higher-priority labels reserve space first in dense scenes. */
  priority?: number
}

type RectGeometry = Omit<AnnotationRect, 'visible'>

const overlaps = (a: RectGeometry, b: RectGeometry, padding = 2) => !(
  a.x + a.width + padding <= b.x ||
  b.x + b.width + padding <= a.x ||
  a.y + a.height + padding <= b.y ||
  b.y + b.height + padding <= a.y
)

/**
 * Place compact labels near their boxes while avoiding earlier labels.
 * Candidates prefer top-left, then inside-top, bottom-left, and right edge.
 * The stable order keeps screenshots and video annotations from jittering.
 */
export function layoutAnnotationLabels(
  requests: AnnotationRequest[],
  canvasWidth: number,
  canvasHeight: number,
): AnnotationRect[] {
  const visibleRects: AnnotationRect[] = []
  const result: AnnotationRect[] = new Array(requests.length)
  const orderedIndexes = requests
    .map((_, index) => index)
    .sort((a, b) => (requests[b].priority ?? 0) - (requests[a].priority ?? 0) || a - b)

  for (const requestIndex of orderedIndexes) {
    const request = requests[requestIndex]
    const [x, y, boxWidth, boxHeight] = request.anchor
    const width = Math.min(request.width, canvasWidth)
    const height = Math.min(request.height, canvasHeight)
    const candidates = [
      { x, y: y - height },
      { x, y },
      { x, y: y + boxHeight },
      { x: x + boxWidth - width, y: y - height },
      { x: x + boxWidth + 2, y },
    ]

    let best: RectGeometry | null = null
    let bestCollisions = Number.POSITIVE_INFINITY
    for (const candidate of candidates) {
      const rect = {
        x: Math.max(0, Math.min(canvasWidth - width, candidate.x)),
        y: Math.max(0, Math.min(canvasHeight - height, candidate.y)),
        width,
        height,
      }
      const collisions = visibleRects.reduce((count, prior) => count + Number(overlaps(rect, prior)), 0)
      if (collisions < bestCollisions) {
        best = rect
        bestCollisions = collisions
      }
      if (collisions === 0) break
    }
    const placement = { ...best!, visible: bestCollisions === 0 }
    result[requestIndex] = placement
    if (placement.visible) visibleRects.push(placement)
  }

  return result
}
