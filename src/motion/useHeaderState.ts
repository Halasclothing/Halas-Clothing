import { useEffect, useRef, useState } from 'react'
import { subscribeScroll } from './scrollBus'

/**
 * Header behaviour (Effect 7): a hairline appears once the page moves and the
 * bar tucks away on downward scroll so it never covers garments or controls.
 */
export function useHeaderState(threshold = 24) {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const last = useRef(0)

  useEffect(() => {
    last.current = window.scrollY
    return subscribeScroll(() => {
      const y = Math.max(0, window.scrollY)
      const delta = y - last.current
      setScrolled(y > threshold)
      setHidden(y > 420 && delta > 6)
      last.current = y
    })
  }, [threshold])

  return { scrolled, hidden }
}
