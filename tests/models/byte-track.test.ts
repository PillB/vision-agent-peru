import assert from 'node:assert/strict'
import test from 'node:test'
import { ByteTrackCompatibleTracker } from '../../src/lib/byte-track'

test('low-confidence second-stage detection recovers but does not create a track', () => {
  const tracker = new ByteTrackCompatibleTracker(0.5, 0.1, 0.3)
  const first = tracker.update([{ class: 'person', score: 0.9, bbox: [0, 0, 20, 20] }], 1)
  const recovered = tracker.update([{ class: 'person', score: 0.2, bbox: [1, 1, 20, 20] }], 2)
  assert.equal(first[0].localTrackId, recovered[0].localTrackId)

  const isolated = new ByteTrackCompatibleTracker(0.5, 0.1, 0.3)
  assert.deepEqual(isolated.update([{ class: 'person', score: 0.2, bbox: [0, 0, 20, 20] }], 1), [])
})

test('local track IDs reset between video sources', () => {
  const tracker = new ByteTrackCompatibleTracker()
  const first = tracker.update([{ class: 'car', score: 0.9, bbox: [0, 0, 20, 20] }], 1)[0]
  tracker.reset()
  const next = tracker.update([{ class: 'car', score: 0.9, bbox: [0, 0, 20, 20] }], 1)[0]
  assert.equal(first.localTrackId, 'track-1')
  assert.equal(next.localTrackId, 'track-1')
})
