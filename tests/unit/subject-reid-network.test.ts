import assert from 'node:assert/strict'
import test from 'node:test'
import { SubjectReidentifier } from '../../src/lib/subject-reid'

const detection = (x: number) => ({ bbox: [x, 10, 10, 20] as [number, number, number, number], class: 'person', score: 0.9 })

test('co-occurrence edges use measured proximity and elapsed shared duration', () => {
  const close = new SubjectReidentifier()
  close.processFrame([detection(10), detection(25)], 100, 100, 1_000)
  close.processFrame([detection(10), detection(25)], 100, 100, 1_250)
  const closeEdge = close.getCoOccurrenceNetwork().edges[0]

  const far = new SubjectReidentifier()
  far.processFrame([detection(0), detection(80)], 100, 100, 1_000)
  far.processFrame([detection(0), detection(80)], 100, 100, 1_250)
  const farEdge = far.getCoOccurrenceNetwork().edges[0]

  assert.ok(closeEdge.proximityScore > farEdge.proximityScore)
  assert.equal(closeEdge.sharedDurationMs, 250)
  assert.equal(closeEdge.encounterCount, 1)
  assert.ok(closeEdge.durationScore > 0)
  assert.ok(closeEdge.familiarityScore > farEdge.familiarityScore)
})

test('separate periods together increment edge encounter count', () => {
  const tracker = new SubjectReidentifier()
  tracker.processFrame([detection(10), detection(25)], 100, 100, 1_000)
  tracker.processFrame([], 100, 100, 5_000)
  tracker.processFrame([detection(10), detection(25)], 100, 100, 9_000)

  const edge = tracker.getCoOccurrenceNetwork().edges[0]
  assert.equal(edge.encounterCount, 2)
})

test('active subjects retain their own bbox when several share a class', () => {
  const tracker = new SubjectReidentifier()
  const subjects = tracker.processFrame([detection(10), detection(70)], 100, 100, 1_000)

  assert.equal(subjects.length, 2)
  assert.deepEqual(subjects.map(subject => subject.bbox), [detection(10).bbox, detection(70).bbox])
  assert.deepEqual(subjects.map(subject => subject.score), [0.9, 0.9])
  assert.notEqual(subjects[0].trackId, subjects[1].trackId)
})
