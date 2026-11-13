import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** True when the OS asks for reduced motion, or the ?motion=off test hook is set. */
export const isReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false
  if (document.documentElement.dataset.motion === 'off') return true
  return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(isReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(isReducedMotion())
    mq.addEventListener('change', onChange)
    window.addEventListener('halas:motion', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('halas:motion', onChange)
    }
  }, [])

  return reduced
}
