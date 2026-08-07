import assert from 'node:assert/strict'
import test from 'node:test'
import { assessAbsence, proposeAssociation } from '../../src/lib/association'
import type { EvidenceRecord } from '../../src/lib/evidence'

function evidence(id: string, vector: number[], cameraId = 'camera-a', timestamp = 1_000): EvidenceRecord {
  return {
    id, createdAt: timestamp, cameraId, useCaseId: 'test', timestamp,
    snapshotDataUrl: 'data:image/jpeg;base64,', detection: { class: 'person', score: 0.9, bbox: [0, 0, 10, 20] },
    embedding: new Float32Array(vector), trackId: `${id}:track`,
  }
}

test('open-set rejection never forces an unrelated observation into an association', () => {
  const result = proposeAssociation(evidence('left', [1, 0]), evidence('right', [0, 1], 'camera-b', 60_000))
  assert.equal(result.decision, 'incompatible')
  assert.ok(result.conflicts.some(item => item.includes('Appearance score')))
})

test('absence assessment uses safe wording and reports coverage limitations', () => {
  const result = assessAbsence(new Float32Array([1, 0]), 'blue jacket', [evidence('other', [0, 1])], {
    videosSearched: ['video-a'],
    timeRanges: [{ videoId: 'video-a', startSeconds: 0, endSeconds: 30 }],
    percentSampled: 20,
    detectorRecallEstimate: 0,
    failedIntervals: [{ videoId: 'video-a', startSeconds: 12, reason: 'decode failed' }],
    skippedIntervals: [{ videoId: 'video-a', startSeconds: 2, endSeconds: 8, reason: 'sampling gap' }],
  })
  assert.equal(result.result, 'inconclusive')
  assert.ok(result.explanation.startsWith('No candidate exceeded the validated threshold within the analyzed coverage.'))
  assert.equal(result.analyzedDurationSeconds, 30)
  assert.equal(result.failedIntervals.length, 1)
  assert.equal(result.skippedIntervals.length, 1)
})
