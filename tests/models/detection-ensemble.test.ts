import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeEnsembleDetections } from '../../src/lib/models/detection-ensemble'

test('object-detector ensembles suppress overlapping duplicate labels', () => {
  const merged = mergeEnsembleDetections([
    { class: 'person', score: 0.91, bbox: [10, 10, 30, 50] },
    { class: 'person', score: 0.84, bbox: [11, 11, 30, 50] },
    { class: 'car', score: 0.8, bbox: [11, 11, 30, 50] },
  ])
  assert.equal(merged.length, 2)
  assert.equal(merged.find(item => item.class === 'person')?.score, 0.91)
  assert.ok(merged.some(item => item.class === 'car'))
})

test('spatially distinct detections of the same class are retained', () => {
  const merged = mergeEnsembleDetections([
    { class: 'person', score: 0.9, bbox: [0, 0, 10, 10] },
    { class: 'person', score: 0.8, bbox: [50, 50, 10, 10] },
  ])
  assert.equal(merged.length, 2)
})
