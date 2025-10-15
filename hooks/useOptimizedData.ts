import { useState, useEffect, useCallback, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiry: number
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_EXPIRY = 5 * 60 * 1000 // 5 minutes

  set<T>(key: string, data: T, expiry = this.DEFAULT_EXPIRY): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp > entry.expiry) {
      this.cache.delete(key)
      return false
    }

    return true
  }
}

const globalCache = new DataCache()

interface UseOptimizedDataOptions {
  cacheKey: string
  cacheExpiry?: number
  enabled?: boolean
  refetchInterval?: number
}

export function useOptimizedData<T>(
  fetchFn: () => Promise<T>,
  options: UseOptimizedDataOptions
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const { cacheKey, cacheExpiry, enabled = true, refetchInterval } = options

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return

    // Check cache first
    if (!force && globalCache.has(cacheKey)) {
      const cachedData = globalCache.get<T>(cacheKey)
      if (cachedData) {
        setData(cachedData)
        return cachedData
      }
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()
      
      // Cache the result
      globalCache.set(cacheKey, result, cacheExpiry)
      setData(result)
      return result
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchFn, cacheKey, cacheExpiry, enabled])

  const refetch = useCallback(() => fetchData(true), [fetchData])

  const clearCache = useCallback(() => {
    globalCache.clear()
  }, [])

  useEffect(() => {
    fetchData()

    // Set up refetch interval if specified
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData()
      }, refetchInterval)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchData, refetchInterval])

  return {
    data,
    loading,
    error,
    refetch,
    clearCache
  }
}
