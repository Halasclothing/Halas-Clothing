import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../motion/useFocusTrap'

interface DrawerProps {
  open: boolean
  onClose: () => void
  label: string
  side?: 'left' | 'right'
  className?: string
  children: ReactNode
}

/**
 * Effect 7: drawer entrance. Stays mounted so the panel can slide both ways,
 * is inert and click-through while closed, and traps focus while open.
 * Escape is handled by the UI provider, which owns the single overlay listener.
 */
export function Drawer({ open, onClose, label, side = 'right', className = '', children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <div
      className={`drawer ${side === 'left' ? 'drawer--left' : ''} ${className}`.trim()}
      data-open={open}
      aria-hidden={!open}
      {...(!open ? { inert: '' } : {})}
    >
      <div className="drawer__backdrop" onClick={onClose} />
      <div
        className="drawer__panel overlay-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
