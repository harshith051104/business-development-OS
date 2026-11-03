import { useEffect, useState } from 'react'

/** useState that remembers its value in this browser (a per-viewer convenience, e.g. table vs card view). */
export function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key) as T | null
      return saved && allowed.includes(saved) ? saved : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
  }, [key, value])
  return [value, setValue] as const
}
