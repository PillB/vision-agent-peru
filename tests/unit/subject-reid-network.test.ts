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
  assert.ok(closeEdge.familiarityScore > farEdge.familiarityScore)
})
