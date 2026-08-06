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
const DB_VERSION = 1
const STORES = ['alerts', 'reports', 'actions', 'evidence', 'meta'] as const
type StoreName = (typeof STORES)[number]

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
    req.onerror = () => resolve(null)
  })
  return dbPromise
}

/**
 * Put a record into a store. No-op if IndexedDB unavailable.
 */
export async function idbPut<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  const db = await openDB()
  if (!db) return
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/**
 * Bulk-put many records. Useful for snapshot persistence.
 */
export async function idbPutMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
  const db = await openDB()
  if (!db) return
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const v of values) os.put(v)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/**
 * Get all records from a store.
 */
export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  if (!db) return []
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
  if (!db) return null
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
  if (!db) return
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/**
 * Clear an entire store.
 */
export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDB()
  if (!db) return
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/**
 * Test if IndexedDB is available (not in private browsing, etc.).
 */
export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
