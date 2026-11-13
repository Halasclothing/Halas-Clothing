import { useEffect, useRef } from 'react'
import { subscribeScroll } from '../motion/scrollBus'
import { usePrefersReducedMotion } from '../motion/reducedMotion'

/** Frames live in /public/scroll-frames as frame_0001.webp … frame_0276.webp */
const FRAME_COUNT = 276
/** Dark veil painted over every frame so the page text stays readable (0 = none, 1 = black). */
const VEIL = 0.5
/** Cap the canvas pixel ratio — the frames are 1280×720, more resolution is wasted. */
const MAX_DPR = 1.5
/** How many frames download at once. */
const CONCURRENCY = 6
/** Scroll-follow smoothing: higher = snappier, lower = more floaty. */
const EASE = 0.18

const frameUrl = (n: number) => `/scroll-frames/frame_${String(n).padStart(4, '0')}.webp`

/**
 * Homepage-only background: a fixed full-screen canvas whose frame follows the
 * scroll position. It adds `has-scroll-bg` to <html> while mounted
 * (see styles/scroll-bg.css).
 */
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
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.imageSmoothingQuality = 'high'

    // Phones get every 2nd frame: half the download and far less decoded-image memory.
    const step = window.matchMedia('(max-width: 768px)').matches ? 6 : 3
    const frames: number[] = []
    for (let n = 1; n <= FRAME_COUNT; n += step) frames.push(n)
    if (frames[frames.length - 1] !== FRAME_COUNT) frames.push(FRAME_COUNT)
    const total = frames.length

    const images: (HTMLImageElement | undefined)[] = new Array(total)
    const ready: boolean[] = new Array(total).fill(false)

    let cancelled = false
    let target = 0 // where the scroll wants us (float, 0 … total-1)
    let shown = 0 // where we currently are (eased)
    let drawn = -1 // index currently on the canvas
    let raf = 0
    let lastW = 0
    let lastH = 0

    const nearestReady = (i: number): number => {
      for (let d = 0; d < total; d++) {
        if (i - d >= 0 && ready[i - d]) return i - d
        if (i + d < total && ready[i + d]) return i + d
      }
      return -1
    }

    const paint = (i: number) => {
      const idx = nearestReady(Math.min(total - 1, Math.max(0, i)))
      if (idx < 0 || idx === drawn) return
      const img = images[idx]
      if (!img) return
      const cw = canvas.width
      const ch = canvas.height
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) // object-fit: cover
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
      ctx.fillStyle = `rgba(8, 7, 5, ${VEIL})`
      ctx.fillRect(0, 0, cw, ch)
      drawn = idx
    }

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
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
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    // Download order: a coarse pass first (every 16th, 8th, 4th … frame), so the
    // animation is usable within moments and fills in as the rest arrives.
    const order: number[] = []
    if (reduced) {
      order.push(0)
    } else {
      const seen = new Set<number>()
      for (const s of [16, 8, 4, 2, 1]) {
        for (let i = 0; i < total; i += s) {
          if (!seen.has(i)) {
            seen.add(i)
            order.push(i)
          }
        }
      }
      if (!seen.has(total - 1)) order.push(total - 1)
    }

    let cursor = 0
    let active = 0
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
          if (ok) {
            images[i] = img
            ready[i] = true
            paint(Math.round(shown))
          }
          pump()
        }
        img
          .decode()
          .then(() => done(true))
          .catch(() => done(false))
      }
    }

    resize()
    window.addEventListener('resize', resize)
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
