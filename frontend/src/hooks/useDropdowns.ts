import { useState, useEffect, useCallback } from 'react'
import { configService } from '../services/config'
import type { DropdownConfig } from '../services/config'

export function useDropdowns() {
  const [config, setConfig] = useState<DropdownConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await configService.getDropdowns()
      setConfig(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(() => {
    configService.invalidateCache()
    load()
  }, [load])

  return { config, loading, error, refresh }
}
