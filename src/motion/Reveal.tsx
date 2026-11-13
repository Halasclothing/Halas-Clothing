import { useEffect, useRef } from 'react'
import type { CSSProperties, ElementType, HTMLAttributes, RefObject } from 'react'
import { isReducedMotion } from './reducedMotion'

let observer: IntersectionObserver | null | undefined

const railObservers = new WeakMap<Element, IntersectionObserver>()

const getRailObserver = (rail: Element): IntersectionObserver => {
  let io = railObservers.get(rail)
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io?.unobserve(entry.target)
          }
        }
      },
      { root: rail as HTMLElement, rootMargin: '0px 30% 0px 0px', threshold: 0 },
    )
    railObservers.set(rail, io)
  }
  return io
}

const observerFor = (el: HTMLElement): IntersectionObserver | null => {
  const rail = el.closest('.rail')
  if (rail && typeof IntersectionObserver === 'function') return getRailObserver(rail)
  return getObserver()
}

const getObserver = (): IntersectionObserver | null => {
  if (observer === undefined) {
    observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  entry.target.classList.add('is-in')
                  observer?.unobserve(entry.target)
                }
              }
            },
            { rootMargin: '0px 0px -12% 0px', threshold: 0 },
          )
        : null
  }
  return observer
}

/** Attaches the shared scroll-reveal behaviour to one element. */
export function useRevealRef<T extends HTMLElement>(ref: RefObject<T>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isReducedMotion()) {
      el.classList.add('is-in')
      return
    }
    const io = observerFor(el)
    if (!io) {
      el.classList.add('is-in')
      return
    }
    io.observe(el)
    return () => io.unobserve(el)
  }, [ref])
}

export type RevealVariant =
  | 'up'
  | 'fade'
  | 'left'
  | 'right'
  | 'mask'
  | 'mask-side'
  | 'curtain'
  | 'rise'

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  variant?: RevealVariant
  delay?: number
  distance?: number
  href?: string
  to?: string
}

/** The single opt-in wrapper for every scroll-triggered reveal. */
export function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  distance,
  style,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  useRevealRef(ref)

  const motionStyle: CSSProperties = { ...style }
  if (delay > 0) (motionStyle as Record<string, string>)['--reveal-delay'] = `${delay}ms`
  if (typeof distance === 'number') (motionStyle as Record<string, string>)['--reveal-y'] = `${distance}px`

  return (
    <Tag ref={ref} data-reveal={variant} style={motionStyle} {...rest}>
      {children}
    </Tag>
  )
}

interface DisplayLinesProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  lines: ReactNodeString[]
  step?: number
  baseDelay?: number
}

type ReactNodeString = string

/** Effect 2: oversized display type released line by line from behind a mask. */
export function DisplayLines({
  as: Tag = 'h2',
  lines,
  step = 110,
  baseDelay = 0,
  className,
  ...rest
}: DisplayLinesProps) {
  const ref = useRef<HTMLElement>(null)
  useLineMasks(ref)

  return (
    <Tag ref={ref} className={className} {...rest}>
      {lines.map((line, i) => (
        <span className="line-mask" key={i} data-index={i}>
          <span
            style={
              {
                '--reveal-delay': `${baseDelay + i * step}ms`,
              } as CSSProperties
            }
          >
            {line}
          </span>
        </span>
      ))}
    </Tag>
  )
}

/** Each .line-mask needs its own in-view flag. */
export function useLineMasks<T extends HTMLElement>(ref: RefObject<T>): void {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const masks = Array.from(root.querySelectorAll<HTMLElement>('.line-mask'))
    if (isReducedMotion()) {
      masks.forEach((m) => m.classList.add('is-in'))
      return
    }
    const io = getObserver()
    if (!io) {
      masks.forEach((m) => m.classList.add('is-in'))
      return
    }
    masks.forEach((m) => io.observe(m))
    return () => masks.forEach((m) => io.unobserve(m))
  }, [ref])
}

/** Inline stagger index helper for [data-stagger] groups. */
export const stagger = (i: number, step = 80): CSSProperties =>
  ({ '--i': String(i), '--stagger-step': `${step}ms` }) as CSSProperties
