import { useEffect, useRef } from 'react'
import { subscribeScroll } from './scrollBus'

const MAX_OFFSET = 120

/**
 * Effect 4: restrained, scroll-linked image movement. Transform only, clamped,
 * paused off-screen, and skipped entirely under reduced motion.
 */
export function useParallax<T extends HTMLElement>(speed = 0.08) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const clear = () => {
      el.style.transform = ''
    }

    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) return
      const centre = rect.top + rect.height / 2 - window.innerHeight / 2
      const offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, centre * speed))
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return clear
    const unsubscribe = subscribeScroll(update)
    return () => {
      unsubscribe()
      clear()
    }
  }, [speed])

  return ref
}
