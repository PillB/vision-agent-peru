export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationRequest {
  anchor: [number, number, number, number]
  width: number
  height: number
}

const overlaps = (a: AnnotationRect, b: AnnotationRect, padding = 2) => !(
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
  const placed: AnnotationRect[] = []

  for (const request of requests) {
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

    let best: AnnotationRect | null = null
    let bestCollisions = Number.POSITIVE_INFINITY
    for (const candidate of candidates) {
      const rect = {
        x: Math.max(0, Math.min(canvasWidth - width, candidate.x)),
        y: Math.max(0, Math.min(canvasHeight - height, candidate.y)),
        width,
        height,
      }
      const collisions = placed.reduce((count, prior) => count + Number(overlaps(rect, prior)), 0)
      if (collisions < bestCollisions) {
        best = rect
        bestCollisions = collisions
      }
      if (collisions === 0) break
    }
    placed.push(best!)
  }

  return placed
}
