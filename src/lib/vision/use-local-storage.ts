'use client'

import { useSyncExternalStore, useCallback, useRef } from 'react'

/**
 * useLocalStorage — typed, SSR-safe localStorage-backed state via
 * useSyncExternalStore.
 *
 * IMPORTANT: useSyncExternalStore calls getSnapshot on every render and
 * compares references. Since JSON.parse returns a NEW object/array each
 * call, we must cache the last-read snapshot (by serialized string) so the
 * reference is stable across renders when the value hasn't changed —
 * otherwise React detects an infinite change loop.
 *
 * - SSR returns `initial` (getServerSnapshot), client returns parsed stored
 *   value → deterministic, no hydration mismatch.
 * - set() writes to localStorage and dispatches an in-tab event so the same
 *   tab re-renders; cross-tab updates come via the native `storage` event.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  // Cache the last-read serialized value + parsed reference so getSnapshot
  // is referentially stable when the underlying storage hasn't changed.
  const cacheRef = useRef<{ raw: string | null; value: T }>({ raw: undefined, value: initial })

  const subscribe = useCallback((onStoreChange: () => void) => {
    const handler = (e: StorageEvent) => {
      if (e.key === key || e.key === null) onStoreChange()
    }
    window.addEventListener('storage', handler)
    const custom = () => onStoreChange()
    window.addEventListener('vap:local-storage-' + key, custom)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('vap:local-storage-' + key, custom)
    }
  }, [key])

  const getSnapshot = useCallback((): T => {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(key)
    } catch {
      raw = null
    }
    // Return cached reference if the serialized value hasn't changed.
    if (cacheRef.current.raw === raw) {
      return cacheRef.current.value
    }
    let parsed: T
    try {
      parsed = raw == null ? initial : (JSON.parse(raw) as T)
    } catch {
      parsed = initial
    }
    cacheRef.current = { raw, value: parsed }
    return parsed
  }, [key, initial])

  const getServerSnapshot = useCallback((): T => initial, [initial])

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const prev = cacheRef.current.value
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      try {
        const serialized = JSON.stringify(next)
        window.localStorage.setItem(key, serialized)
        cacheRef.current = { raw: serialized, value: next }
        window.dispatchEvent(new Event('vap:local-storage-' + key))
      } catch {
        // ignore quota / access errors
      }
    },
    [key],
  )

  return [value, set]
}
