import { Link, NavLink, useLocation } from 'react-router-dom'
import { useCart } from '../state/cart'
import { useWishlist } from '../state/wishlist'
import { useUi } from '../state/ui'
import { useHeaderState } from '../motion/useHeaderState'
import { usePulse } from '../motion/useScrollLock'
import { IconBag, IconHeart, IconMenu, IconSearch } from './Icons'

const DESKTOP_NAV = [
  { to: '/collections/new-in', label: 'New In' },
  { to: '/collections/ready-to-wear', label: 'Ready to Wear' },
  { to: '/collections/dresses', label: 'Dresses' },
  { to: '/collections/co-ord-sets', label: 'Co-Ord Sets' },
  { to: '/collections/sale', label: 'Sale' },
  { to: '/lookbook', label: 'Lookbook' },
  { to: '/journal', label: 'Journal' },
]

export function Header() {
  const { scrolled, hidden } = useHeaderState()
  const { open } = useUi()
  const cart = useCart()
  const wishlist = useWishlist()
  const location = useLocation()
  const cartPulse = usePulse(cart.count)
  const wishPulse = usePulse(wishlist.count)

  return (
    <header className="site-header" data-scrolled={scrolled} data-hidden={hidden && location.pathname !== '/'}>
      <div className="header__inner">
        <button
          type="button"
          className="icon-btn header__menu-btn"
          onClick={() => open('menu')}
          aria-label="Open menu"
        >
          <IconMenu />
        </button>

        <Link to="/" className="brand">
          HALA<span className="mark">.</span>S
        </Link>

        <nav className="header__nav" aria-label="Main">
          {DESKTOP_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="link-sweep">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header__actions">
          <button type="button" className="icon-btn" onClick={() => open('search')} aria-label="Open search">
            <IconSearch />
            <span className="header__search-label">Search</span>
          </button>

          <Link to="/wishlist" className="icon-btn" aria-label={`Wishlist, ${wishlist.count} items`}>
            <IconHeart />
            {wishlist.count > 0 && (
              <span className={`count ${wishPulse ? 'badge-pop' : ''}`} key={wishlist.count}>
                {wishlist.count}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="icon-btn"
            onClick={() => open('cart')}
            aria-label={`Open bag, ${cart.count} items`}
          >
            <IconBag />
            <span className="header__bag-label">Bag</span>
            {cart.count > 0 && (
              <span className={`count ${cartPulse ? 'badge-pop' : ''}`} key={cart.count}>
                {cart.count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
