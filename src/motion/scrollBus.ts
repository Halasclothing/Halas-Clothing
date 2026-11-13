/**
 * One passive scroll/resize listener for the whole site. Every scroll-driven
 * effect subscribes here instead of attaching its own, and work is batched
 * into a single rAF pass. Listeners detach when nothing subscribes.
 */

type Sub = () => void

const subs = new Set<Sub>()
let listening = false
let frame = 0

const run = () => {
  frame = 0
  for (const sub of subs) sub()
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(run)
}

const handler = () => schedule()

export function subscribeScroll(sub: Sub): () => void {
  subs.add(sub)
  sub()
  if (!listening) {
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    listening = true
  }
  return () => {
    subs.delete(sub)
    if (subs.size === 0 && listening) {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
      listening = false
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }
  }
}
