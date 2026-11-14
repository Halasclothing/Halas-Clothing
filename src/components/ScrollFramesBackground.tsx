import { useEffect } from 'react'

/**
 * The storefront is transparent now. Scroll-frame playback is intentionally
 * paused until the owner supplies the final campaign frame sequence.
 * The fixed canvas can be re-enabled here without changing the page layout.
 */
export function ScrollFramesBackground() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('has-scroll-bg')
    return () => root.classList.remove('has-scroll-bg')
  }, [])

  return null
}
