import { useEffect, useState } from 'react'

/**
 * Persist a piece of state in localStorage.
 * - Safe for iOS/PWA reloads: restores on mount.
 * - Supports lazy default via function.
 */
export function usePersistedState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw)
    } catch (_) {}
    return typeof initialValue === 'function' ? initialValue() : initialValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (_) {}
  }, [key, state])

  return [state, setState]
}
