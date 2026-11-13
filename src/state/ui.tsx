import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useScrollLock } from '../motion/useScrollLock'

export type Overlay = 'cart' | 'search' | 'menu' | 'filters' | null

interface UiApi {
  overlay: Overlay
  open: (o: Exclude<Overlay, null>) => void
  close: () => void
  isOpen: (o: Exclude<Overlay, null>) => boolean
  announce: (message: string) => void
  announcement: string
}

const UiContext = createContext<UiApi | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [announcement, setAnnouncement] = useState('')

  useScrollLock(overlay !== null)

  const close = useCallback(() => setOverlay(null), [])

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlay(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay])

  // Screen-reader feedback for cart and wishlist changes.
  useEffect(() => {
    if (!announcement) return
    const t = window.setTimeout(() => setAnnouncement(''), 4000)
    return () => window.clearTimeout(t)
  }, [announcement])

  const value = useMemo<UiApi>(
    () => ({
      overlay,
      open: (o) => setOverlay(o),
      close,
      isOpen: (o) => overlay === o,
      announce: (message) => setAnnouncement(message),
      announcement,
    }),
    [overlay, close, announcement],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export const useUi = (): UiApi => {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used inside UiProvider')
  return ctx
}
