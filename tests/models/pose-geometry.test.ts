import assert from 'node:assert/strict'
import test from 'node:test'
import { selectPoseGeometry } from '../../src/lib/models/pose-geometry'

function poseRow(width: number, height: number, horizontalTorso: boolean, score = 0.9) {
  const row = Array<number>(56).fill(0)
  row.splice(0, 5, 50, 50, width, height, score)
  const setPoint = (index: number, x: number, y: number) => {
    row[5 + index * 3] = x
    row[6 + index * 3] = y
    row[7 + index * 3] = 0.9
  }
  setPoint(5, 40, 40)
  setPoint(6, horizontalTorso ? 40 : 60, horizontalTorso ? 60 : 40)
  setPoint(11, horizontalTorso ? 60 : 40, 60)
  setPoint(12, 60, horizontalTorso ? 40 : 60)
  return row
}

test('pose geometry distinguishes localized horizontal and upright candidates', () => {
  const horizontal = selectPoseGeometry([poseRow(60, 30, true)], 0.3, 100, 100, 200, 200)
  const upright = selectPoseGeometry([poseRow(30, 70, false)], 0.3, 100, 100, 200, 200)
  assert.equal(horizontal?.horizontal, true)
  assert.equal(upright?.horizontal, false)
  assert.deepEqual(horizontal?.bbox, [40, 70, 120, 60])
})

test('pose geometry rejects candidates below confidence threshold', () => {
  assert.equal(selectPoseGeometry([poseRow(60, 30, true, 0.2)], 0.3, 100, 100, 100, 100), null)
})
