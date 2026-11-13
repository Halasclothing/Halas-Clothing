import { useCallback, useEffect, useState } from 'react'

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[], initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    loader()
      .then((value) => {
        if (!alive) return
        setData(value)
        setLoading(false)
      })
      .catch((reason) => {
        if (!alive) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setLoading(false)
      })
    return () => {
      alive = false
    }
    // The caller supplies the dependency list for the loader.
  }, [...deps, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { data, loading, error, reload, setData }
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useOnEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onEscape, active])
}
