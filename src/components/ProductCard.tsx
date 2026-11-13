import { Link } from 'react-router-dom'
import type { Product } from '../data/types'
import { isOnSale } from '../data/catalog'
import { formatPrice } from '../data/format'
import { EditorialImage } from './EditorialFrame'
import { WishlistButton } from './WishlistButton'
import { Reveal, stagger } from '../motion/Reveal'
import type { CSSProperties } from 'react'

interface ProductCardProps {
  product: Product
  index?: number
  eager?: boolean
  sizes?: string
  className?: string
  style?: CSSProperties
  as?: 'article' | 'li'
}

/**
 * Card interactions are hover-independent: the wishlist control is always
 * visible and the second image is an enhancement, never a requirement.
 */
export function ProductCard({
  product,
  index,
  eager = false,
  sizes = '(max-width: 700px) 46vw, 320px',
  className = '',
  style,
  as: Tag = 'article',
}: ProductCardProps) {
  const second = product.images[1]

  return (
    <Reveal
      as={Tag}
      variant="up"
      delay={0}
      className={`card ${className}`.trim()}
      style={typeof index === 'number' ? { ...style, ...stagger(index) } : style}
    >
      <div className="card__media frame frame--portrait img-swap hover-zoom">
        <EditorialImage
          className="swap-main"
          img={product.images[0]}
          sizes={sizes}
          eager={eager}
        />
        {second && <EditorialImage className="swap-alt" img={second} alt="" sizes={sizes} />}
        {isOnSale(product) && (
          <span className="card__flag micro" aria-hidden="true">
            Sale
          </span>
        )}
        <WishlistButton product={product} className="card__wishlist" />
      </div>

      <div className="card__body">
        <div className="card__row">
          <h3 className="card__title">
            <Link to={`/product/${product.handle}`}>
              <span className="u">{product.title}</span>
            </Link>
          </h3>
          <p className="price">
            {product.compareAtPrice && <span className="was">{formatPrice(product.compareAtPrice)}</span>}
            <span>{formatPrice(product.price)}</span>
          </p>
        </div>
        <p className="micro micro--stone">
          {product.colourName}
          {product.sizes.some((s) => !s.available) && ' · limited sizes'}
        </p>
      </div>
    </Reveal>
  )
}
