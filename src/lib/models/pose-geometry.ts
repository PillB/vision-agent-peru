export interface PoseGeometryCandidate {
  score: number
  bbox: [number, number, number, number]
  horizontal: boolean
}

/** Convert YOLOv8-pose rows into the strongest localized fall candidate. */
export function selectPoseGeometry(
  rows: number[][],
  threshold: number,
  inputWidth: number,
  inputHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): PoseGeometryCandidate | null {
  const scaleX = canvasWidth / Math.max(1, inputWidth)
  const scaleY = canvasHeight / Math.max(1, inputHeight)
  let best: PoseGeometryCandidate | null = null

  for (const row of rows) {
    if (row.length < 56) continue
    const score = Number(row[4])
    if (score < threshold) continue
    const [cx, cy, width, height] = row
    const bbox: [number, number, number, number] = [
      Math.max(0, (cx - width / 2) * scaleX),
      Math.max(0, (cy - height / 2) * scaleY),
      Math.min(canvasWidth, width * scaleX),
      Math.min(canvasHeight, height * scaleY),
    ]
    const point = (index: number) => ({
      x: Number(row[5 + index * 3]) * scaleX,
      y: Number(row[6 + index * 3]) * scaleY,
      visible: Number(row[7 + index * 3]),
    })
    const leftShoulder = point(5)
    const rightShoulder = point(6)
    const leftHip = point(11)
    const rightHip = point(12)
    const torsoVisible = [leftShoulder, rightShoulder, leftHip, rightHip].every(point => point.visible >= 0.3)
    const shoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 }
    const hip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
    const torsoHorizontal = torsoVisible && Math.abs(hip.y - shoulder.y) < Math.abs(hip.x - shoulder.x) * 0.8
    const boxHorizontal = bbox[2] > bbox[3] * 1.15
    const candidate = { score, bbox, horizontal: torsoHorizontal || boxHorizontal }
    if (!best || Number(candidate.horizontal) > Number(best.horizontal) || (candidate.horizontal === best.horizontal && score > best.score)) {
      best = candidate
    }
  }
  return best
}
