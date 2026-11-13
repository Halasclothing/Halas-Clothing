import type { ImageRef } from '../data/types'
import { Reveal, type RevealVariant } from '../motion/Reveal'
import { useParallax } from '../motion/useParallax'

interface ImgProps {
  img: ImageRef
  alt?: string
  className?: string
  sizes?: string
  eager?: boolean
}

export function EditorialImage({ img, alt, className, sizes, eager = false }: ImgProps) {
  return (
    <img
      className={className}
      src={img.src}
      srcSet={`${img.small} 420w, ${img.src} ${img.width}w`}
      sizes={sizes ?? '(max-width: 700px) 90vw, 420px'}
      width={img.width}
      height={img.height}
      alt={alt ?? img.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      {...(eager ? ({ fetchpriority: 'high' } as Record<string, string>) : {})}
    />
  )
}

type Ratio = 'portrait' | 'tall' | 'wide' | 'square' | 'hero'

interface FrameProps extends ImgProps {
  ratio?: Ratio
  variant?: RevealVariant
  delay?: number
  hoverZoom?: boolean
  parallax?: number
}

/**
 * Every campaign and product image on the site goes through this frame:
 * a reserved aspect-ratio box (no layout shift), a lazy image, one reveal
 * variant from the motion system, and optional scroll-linked movement.
 */
export function EditorialFrame({
  img,
  alt,
  className = '',
  sizes,
  eager = false,
  ratio = 'portrait',
  variant = 'mask',
  delay = 0,
  hoverZoom = false,
  parallax,
}: FrameProps) {
  const classes = `frame frame--${ratio} ${hoverZoom ? 'hover-zoom' : ''} ${className}`.trim()

  const inner = (
    <Reveal as="div" variant={variant} delay={delay} className={classes}>
      <EditorialImage img={img} alt={alt} sizes={sizes} eager={eager} />
    </Reveal>
  )

  if (typeof parallax === 'number') {
    return <ParallaxShell speed={parallax}>{inner}</ParallaxShell>
  }
  return inner
}

function ParallaxShell({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useParallax<HTMLDivElement>(speed)
  return (
    <div ref={ref} data-parallax="">
      {children}
    </div>
  )
}
