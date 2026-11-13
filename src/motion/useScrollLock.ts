import { useEffect, useState } from 'react'

/** Shared by every fixed overlay: locks the page and patches the scrollbar gap. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const gap = window.innerWidth - root.clientWidth
    root.classList.add('no-scroll')
    if (gap > 0) root.style.paddingRight = `${gap}px`
    return () => {
      root.classList.remove('no-scroll')
      root.style.paddingRight = ''
    }
  }, [active])
}

export function usePulse(value: unknown, ms = 320): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(true)
    const t = window.setTimeout(() => setOn(false), ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return on
}
