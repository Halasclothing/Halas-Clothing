import { Link } from 'react-router-dom'
import { useWishlist } from '../state/wishlist'
import { useDocumentTitle } from '../useDocumentTitle'
import { Reveal } from '../motion/Reveal'
import { ProductCard } from '../components/ProductCard'
import { IconArrow } from '../components/Icons'

export function WishlistPage() {
  const wishlist = useWishlist()
  useDocumentTitle('Wishlist — HALA.S CLOTHING')

  return (
    <div className="container section">
      <Reveal as="p" variant="fade" className="micro micro--stone">
        Saved pieces
      </Reveal>
      <Reveal as="h1" variant="up" delay={60} className="display display--hero" style={{ marginTop: '0.5rem' }}>
        Wishlist
      </Reveal>

      {wishlist.products.length === 0 ? (
        <div className="state">
          <p className="lede">
            Nothing saved yet. Use the heart on any piece to keep it here — the list is stored on this device only.
          </p>
          <Link className="btn btn--solid" to="/collections/all">
            Browse the edit <IconArrow />
          </Link>
        </div>
      ) : (
        <>
          <Reveal as="p" variant="fade" delay={120} className="lede" style={{ margin: '1.2rem 0 2.6rem' }}>
            {wishlist.products.length} {wishlist.products.length === 1 ? 'piece' : 'pieces'} saved. Prices and
            availability are read fresh from the catalogue each time you open this page.
          </Reveal>
          <div className="shop-grid" data-stagger>
            {wishlist.products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
