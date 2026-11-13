import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Reveal } from '../motion/Reveal'

interface SectionHeadProps {
  index?: string
  title: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  action?: { to: string; label: string }
  className?: string
}

export function SectionHead({ index, title, as: Tag = 'h2', action, className = '' }: SectionHeadProps) {
  return (
    <div className={`section-head ${className}`.trim()}>
      <div>
        {index && (
          <Reveal as="p" variant="fade" className="micro section-head__index">
            {index}
          </Reveal>
        )}
        <Reveal as={Tag} variant="up" delay={60} className="display display--lg" style={{ marginTop: '0.4rem' }}>
          {title}
        </Reveal>
      </div>
      {action && (
        <Reveal as="p" variant="fade" delay={120}>
          <Link className="link-sweep" to={action.to}>
            {action.label} <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
      )}
    </div>
  )
}
