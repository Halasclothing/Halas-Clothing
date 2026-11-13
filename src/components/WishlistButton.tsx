import { useState } from 'react'
import type { Product } from '../data/types'
import { useWishlist } from '../state/wishlist'
import { useUi } from '../state/ui'
import { IconHeart } from './Icons'

interface Props {
  product: Product
  className?: string
  labelled?: boolean
}

export function WishlistButton({ product, className = '', labelled = false }: Props) {
  const { has, toggle } = useWishlist()
  const { announce } = useUi()
  const saved = has(product.handle)
  const [pop, setPop] = useState(false)

  const onClick = () => {
    const added = toggle(product.handle)
    setPop(true)
    window.setTimeout(() => setPop(false), 360)
    announce(`${product.title} ${added ? 'saved to wishlist' : 'removed from wishlist'}`)
  }

  return (
    <button
      type="button"
      className={`${className} ${pop ? 'pop' : ''}`.trim()}
      aria-pressed={saved}
      aria-label={`${saved ? 'Remove' : 'Save'} ${product.title} ${labelled ? '' : '— wishlist'}`}
      onClick={onClick}
    >
      <IconHeart />
      {labelled && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  )
}
