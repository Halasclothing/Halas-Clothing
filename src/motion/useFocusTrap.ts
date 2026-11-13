import { useEffect } from 'react'
import type { RefObject } from 'react'

const SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'

/** Keeps Tab inside a dialog while it is open, and restores focus after. */
export function useFocusTrap(ref: RefObject<HTMLElement>, open: boolean, focusFirst = true): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !open) return

    const restore = document.activeElement as HTMLElement | null
    const visible = (node: HTMLElement) => node.offsetWidth > 0 || node.offsetHeight > 0 || node === document.activeElement
    const list = () => Array.from(el.querySelectorAll<HTMLElement>(SELECTOR)).filter(visible)

    const timer = window.setTimeout(() => {
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? list()[0] ?? el
      target.focus({ preventScroll: true })
    }, 60)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusables = list()
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement
      if (event.shiftKey && (activeEl === first || activeEl === el)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      restore?.focus?.({ preventScroll: true })
    }
  }, [ref, open, focusFirst])
}
