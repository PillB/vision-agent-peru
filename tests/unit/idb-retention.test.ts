import assert from 'node:assert/strict'
import test from 'node:test'
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb'
import { idbGetAll, idbPut, purgeExpired, resetIdbConnectionForTests } from '../../src/lib/idb'

Object.defineProperty(globalThis, 'indexedDB', { value: fakeIndexedDB, configurable: true })

test('records survive a connection reset and expired records are purged', async () => {
  const now = 1_000_000
  await idbPut('evidence', { id: 'young', createdAt: now - 1_000 })
  await idbPut('evidence', { id: 'expired', createdAt: now - 100_000 })
  resetIdbConnectionForTests()
  const reopened = await idbGetAll<{ id: string }>('evidence')
  assert.equal(reopened.some(record => record.id === 'young'), true)
  assert.equal(reopened.some(record => record.id === 'expired'), true)
  assert.equal(await purgeExpired('evidence', 50_000, now), 1)
  assert.deepEqual((await idbGetAll<{ id: string }>('evidence')).map(record => record.id), ['young'])
})
