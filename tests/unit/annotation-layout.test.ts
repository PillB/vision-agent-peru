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
  assert.ok(labels.every(label => label.visible))
  assert.notDeepEqual(labels[0], labels[1])
  assert.notDeepEqual(labels[1], labels[2])
})

test('oversized annotation labels are clamped to canvas width', () => {
  const [label] = layoutAnnotationLabels([
    { anchor: [95, 10, 10, 10], width: 200, height: 16 },
  ], 100, 50)
  assert.deepEqual(label, { x: 0, y: 0, width: 100, height: 16, visible: true })
})

test('dense annotations keep the highest-priority readable labels and suppress collisions', () => {
  const labels = layoutAnnotationLabels([
    { anchor: [0, 0, 20, 10], width: 98, height: 18, priority: 0.4 },
    { anchor: [0, 0, 20, 10], width: 98, height: 18, priority: 0.95 },
    { anchor: [0, 0, 20, 10], width: 98, height: 18, priority: 0.7 },
  ], 100, 20)

  assert.equal(labels[1].visible, true)
  assert.equal(labels[0].visible, false)
  assert.equal(labels[2].visible, false)
})
