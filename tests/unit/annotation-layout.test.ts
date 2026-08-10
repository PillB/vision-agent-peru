import assert from 'node:assert/strict'
import test from 'node:test'
import { layoutAnnotationLabels } from '../../src/lib/annotation-layout'

test('annotation labels stay inside the canvas and avoid overlap when alternatives exist', () => {
  const labels = layoutAnnotationLabels([
    { anchor: [5, 5, 60, 50], width: 50, height: 14 },
    { anchor: [8, 8, 60, 50], width: 50, height: 14 },
    { anchor: [12, 12, 60, 50], width: 50, height: 14 },
  ], 120, 90)

  for (const label of labels) {
    assert.ok(label.x >= 0 && label.y >= 0)
    assert.ok(label.x + label.width <= 120)
    assert.ok(label.y + label.height <= 90)
  }
  assert.notDeepEqual(labels[0], labels[1])
  assert.notDeepEqual(labels[1], labels[2])
})

test('oversized annotation labels are clamped to canvas width', () => {
  const [label] = layoutAnnotationLabels([
    { anchor: [95, 10, 10, 10], width: 200, height: 16 },
  ], 100, 50)
  assert.deepEqual(label, { x: 0, y: 0, width: 100, height: 16 })
})
