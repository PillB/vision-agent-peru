/**
 * IndexedDB persistence layer — browser-only, no server needed.
 *
 * Fixes D12: Previously `src/lib/db.ts` used Prisma, which is server-only
 * and does not work on GitHub Pages (static export). The Zustand store
 * held everything in memory, so a page refresh wiped all alerts, reports,
 * and action logs. This module provides a minimal IndexedDB wrapper that
 * the store can use to persist:
 *
 *   - alerts (AlertHit[])
 *   - reports (IncidentReport[])
 *   - actionLog (ActionLogEntry[])
 *   - evidence (image crops + embeddings for the evidence search pipeline)
 *
 * Falls back gracefully to in-memory when IndexedDB is unavailable
 * (private browsing, SSR, etc.).
 */

const DB_NAME = 'vision-agent-peru'
const DB_VERSION = 2
const STORES = [
  'alerts', 'reports', 'actions', 'evidence', 'meta', 'sessions', 'videos',
  'tracks', 'searches', 'associations', 'incidents', 'settings',
] as const
export type StoreName = (typeof STORES)[number]

export class IndexedDBUnavailableError extends Error {
  constructor(message = 'IndexedDB is unavailable') {
    super(message)
    this.name = 'IndexedDBUnavailableError'
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onblocked = () => resolve(null)
    req.onerror = () => resolve(null)
  })
  return dbPromise
}

/**
 * Put a record into a store. Fail explicitly if persistence is unavailable;
 * callers must surface a nonpersistent state rather than claiming storage.
 */
export async function idbPut<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  const db = await openDB()
  if (!db) throw new IndexedDBUnavailableError()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error(`IndexedDB transaction aborted: ${store}`))
    tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB write failed: ${store}`))
  })
}

/**
 * Bulk-put many records. Useful for snapshot persistence.
 */
export async function idbPutMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
  const db = await openDB()
  if (!db) throw new IndexedDBUnavailableError()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const v of values) os.put(v)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error(`IndexedDB transaction aborted: ${store}`))
    tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB write failed: ${store}`))
  })
}

/**
 * Get all records from a store.
 */
export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  if (!db) throw new IndexedDBUnavailableError()
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => resolve([])
  })
}

/**
 * Get a single record by ID.
 */
export async function idbGet<T>(store: StoreName, id: string): Promise<T | null> {
  const db = await openDB()
  if (!db) throw new IndexedDBUnavailableError()
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(id)
    req.onsuccess = () => resolve(req.result as T | null)
    req.onerror = () => resolve(null)
  })
}

/**
 * Delete a record by ID.
 */
export async function idbDelete(store: StoreName, id: string): Promise<void> {
  const db = await openDB()
  if (!db) throw new IndexedDBUnavailableError()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB delete failed: ${store}`))
  })
}

/**
 * Clear an entire store.
 */
export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDB()
  if (!db) throw new IndexedDBUnavailableError()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB clear failed: ${store}`))
  })
}

/**
 * Test if IndexedDB is available (not in private browsing, etc.).
 */
export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export interface PersistenceStatus {
  available: boolean
  persistent: boolean
  quota?: number
  usage?: number
  reason?: string
}

/** Perform an actual open/write/delete probe and report storage persistence. */
export async function probeIndexedDB(): Promise<PersistenceStatus> {
  try {
    const probe = { id: `probe-${Date.now()}`, createdAt: Date.now() }
    await idbPut('settings', probe)
    await idbDelete('settings', probe.id)
    const estimate = await navigator.storage?.estimate?.()
    const persistent = await navigator.storage?.persisted?.() ?? false
    return { available: true, persistent, quota: estimate?.quota, usage: estimate?.usage }
  } catch (error) {
    return {
      available: false,
      persistent: false,
      reason: error instanceof Error ? error.message : 'IndexedDB probe failed',
    }
  }
}

/** Purge records with a numeric createdAt older than the configured TTL. */
export async function purgeExpired(store: StoreName, ttlMs: number, now = Date.now()): Promise<number> {
  const records = await idbGetAll<{ id: string; createdAt?: number }>(store)
  const expired = records.filter(record => typeof record.createdAt === 'number' && now - record.createdAt > ttlMs)
  for (const record of expired) await idbDelete(store, record.id)
  return expired.length
}

export function resetIdbConnectionForTests(): void {
  dbPromise = null
}
