import type { Detection } from '../store'

function iou(a: Detection['bbox'], b: Detection['bbox']) {
  const [ax, ay, aw, ah] = a
  const [bx, by, bw, bh] = b
  const left = Math.max(ax, bx)
  const top = Math.max(ay, by)
  const right = Math.min(ax + aw, bx + bw)
  const bottom = Math.min(ay + ah, by + bh)
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top)
  const union = aw * ah + bw * bh - intersection
  return union > 0 ? intersection / union : 0
}

/** Merge overlapping same-class results from concurrently selected detectors. */
export function mergeEnsembleDetections(detections: Detection[], overlapThreshold = 0.6): Detection[] {
  const ranked = [...detections].sort((a, b) => b.score - a.score)
  const merged: Detection[] = []
  for (const candidate of ranked) {
    const duplicate = merged.some(accepted => accepted.class === candidate.class && iou(accepted.bbox, candidate.bbox) >= overlapThreshold)
    if (!duplicate) merged.push(candidate)
  }
  return merged
}
