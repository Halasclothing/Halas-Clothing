import { useEffect, useRef } from 'react'
import { subscribeScroll } from '../motion/scrollBus'
import { usePrefersReducedMotion } from '../motion/reducedMotion'

/** Campaign sequence already in public/scroll-frames: frame_0001.webp … frame_0276.webp. */
const FRAME_COUNT = 276
const VEIL = 0.18
const MAX_DPR = 1.5
const CONCURRENCY = 5
const EASE = 0.2
const frameUrl = (n: number) => `/scroll-frames/frame_${String(n).padStart(4, '0')}.webp`

/** Fixed full-page scroll animation shared by the storefront and admin portal. */
export function ScrollFramesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('has-scroll-bg')
    return () => root.classList.remove('has-scroll-bg')
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: false, desynchronized: true })
    if (!canvas || !ctx) return
    ctx.imageSmoothingQuality = 'high'

    const step = window.matchMedia('(max-width: 768px)').matches ? 6 : 3
    const frames: number[] = []
    for (let n = 1; n <= FRAME_COUNT; n += step) frames.push(n)
    if (frames[frames.length - 1] !== FRAME_COUNT) frames.push(FRAME_COUNT)
    const total = frames.length
    const images: (HTMLImageElement | undefined)[] = new Array(total)
    const ready = new Array<boolean>(total).fill(false)
    let cancelled = false
    let target = 0
    let shown = 0
    let drawn = -1
    let raf = 0
    let lastW = 0
    let lastH = 0

    const nearestReady = (i: number) => {
      for (let d = 0; d < total; d++) {
        if (i - d >= 0 && ready[i - d]) return i - d
        if (i + d < total && ready[i + d]) return i + d
      }
      return -1
    }
    const paint = (i: number) => {
      const idx = nearestReady(Math.min(total - 1, Math.max(0, i)))
      if (idx < 0 || idx === drawn || !images[idx]) return
      const img = images[idx]!
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
      if (VEIL > 0) {
        ctx.fillStyle = `rgba(8, 7, 5, ${VEIL})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      drawn = idx
    }
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight
      if (w === lastW && h === lastH) return
      lastW = w; lastH = h
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      drawn = -1
      paint(Math.round(shown))
    }
    const tick = () => {
      raf = 0
      const diff = target - shown
      shown = Math.abs(diff) < 0.02 ? target : shown + diff * EASE
      paint(Math.round(shown))
      if (shown !== target) raf = requestAnimationFrame(tick)
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick) }

    const order: number[] = []
    if (reduced) order.push(0)
    else {
      const seen = new Set<number>()
      for (const stride of [16, 8, 4, 2, 1]) {
        for (let i = 0; i < total; i += stride) {
          if (!seen.has(i)) { seen.add(i); order.push(i) }
        }
      }
      if (!seen.has(total - 1)) order.push(total - 1)
    }
    let cursor = 0, active = 0
    const pump = () => {
      while (!cancelled && active < CONCURRENCY && cursor < order.length) {
        const i = order[cursor++]
        active++
        const img = new Image()
        img.decoding = 'async'
        img.src = frameUrl(frames[i])
        const done = (ok: boolean) => {
          active--
          if (cancelled) return
          if (ok) { images[i] = img; ready[i] = true; paint(Math.round(shown)) }
          pump()
        }
        img.decode().then(() => done(true)).catch(() => done(false))
      }
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })
    pump()
    let unsubscribe: (() => void) | undefined
    if (!reduced) {
      unsubscribe = subscribeScroll(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
        target = progress * (total - 1)
        kick()
      })
    }
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      unsubscribe?.()
      images.length = 0
    }
  }, [reduced])

  return <canvas ref={canvasRef} className="scroll-bg" aria-hidden="true" />
}
