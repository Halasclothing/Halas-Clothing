import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ImageRef } from '../data/types'
import { useFocusTrap } from '../motion/useFocusTrap'
import { IconArrow, IconClose } from './Icons'

interface LightboxProps {
  images: ImageRef[]
  index: number
  title: string
  onIndex: (next: number) => void
  onClose: () => void
}

/** Accessible zoom: keyboard and touch friendly, close control always on screen. */
export function Lightbox({ images, index, title, onIndex, onClose }: LightboxProps) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true)

  const total = images.length
  const go = (delta: number) => onIndex((index + delta + total) % total)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      } else if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  let touchStartX = 0

  return createPortal(
    <div
      className="lightbox"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — image ${index + 1} of ${total}`}
      onTouchStart={(e) => {
        touchStartX = e.changedTouches[0]?.clientX ?? 0
      }}
      onTouchEnd={(e) => {
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX
        if (Math.abs(dx) > 44) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="lightbox__bar">
        <p className="micro" style={{ color: 'var(--paper)' }}>
          {title}
        </p>
        <button className="icon-btn" onClick={onClose} aria-label="Close image viewer" data-autofocus>
          <IconClose />
        </button>
      </div>

      <div className="lightbox__stage">
        <img src={images[index].src} alt={images[index].alt} />
      </div>

      <div className="lightbox__bar">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous image">
          <IconArrow style={{ transform: 'rotate(180deg)' }} /> Prev
        </button>
        <span className="micro">
          {index + 1} / {total}
        </span>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Next image">
          Next <IconArrow />
        </button>
      </div>
    </div>,
    document.body,
  )
}
