import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ImageRef } from '../data/types'
import { EditorialImage } from './EditorialFrame'
import { Reveal } from '../motion/Reveal'

export interface ChapterStep {
  numeral?: string
  title: string
  body: ReactNode
  link?: { to: string; label: string }
  media?: ImageRef
}

interface StickyChapterProps {
  eyebrow?: string
  media: ImageRef[]
  steps: ChapterStep[]
  tilt?: boolean
  tone?: 'paper' | 'ink'
}

/**
 * Effect 5: the image stays pinned while the copy scrolls past it. Normal
 * scrolling drives it — no scroll-jacking — and the section always releases
 * after the last step. On narrow screens the pinned column is replaced by an
 * inline image per step so nothing overlaps.
 */
export function StickyChapter({ eyebrow, media, steps, tilt = false, tone = 'paper' }: StickyChapterProps) {
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index ?? 0))
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    stepRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section className={`chapter${tone === 'ink' ? ' section--ink' : ''}`}>
      <div className="container">
        {eyebrow && (
          <Reveal as="p" variant="fade" className="micro micro--stone chapter__label">
            {eyebrow}
          </Reveal>
        )}
        <div className="chapter__grid">
          <div className={`chapter-media${tilt ? ' chapter-media--tilted' : ''}`} aria-hidden="true">
            <div className="stack">
              {media.map((img, i) => (
                <EditorialImage key={img.src} img={img} alt="" sizes="640px" className={i === active ? 'is-active' : ''} />
              ))}
            </div>
          </div>

          <div>
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="step"
                data-index={i}
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
              >
                {step.media && <EditorialImage img={step.media} sizes="90vw" className="step-media" />}
                {step.numeral && (
                  <Reveal as="p" variant="fade" delay={40} className="micro">
                    {step.numeral}
                  </Reveal>
                )}
                <Reveal as="h3" variant="up" delay={80} className="step__title display">
                  {step.title}
                </Reveal>
                <Reveal as="div" variant="up" delay={140} className="prose">
                  <p>{step.body}</p>
                </Reveal>
                {step.link && (
                  <Reveal as="p" variant="fade" delay={200}>
                    <Link className="link-sweep" to={step.link.to}>
                      {step.link.label} <span aria-hidden="true">→</span>
                    </Link>
                  </Reveal>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
