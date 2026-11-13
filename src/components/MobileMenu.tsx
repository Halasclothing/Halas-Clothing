import { Link } from 'react-router-dom'
import { Drawer } from './Drawer'
import { useUi } from '../state/ui'
import { IconArrow, IconClose } from './Icons'

const PRIMARY = [
  { to: '/collections/new-in', label: 'New In' },
  { to: '/collections/all', label: 'All Products' },
  { to: '/collections/ready-to-wear', label: 'Ready to Wear' },
  { to: '/collections/dresses', label: 'Dresses' },
  { to: '/collections/co-ord-sets', label: 'Co-Ord Sets' },
  { to: '/collections/sale', label: 'Sale' },
  { to: '/lookbook', label: 'Lookbook' },
  { to: '/wishlist', label: 'Wishlist' },
]

export function MobileMenu() {
  const { isOpen, close } = useUi()
  const open = isOpen('menu')

  return (
    <Drawer open={open} onClose={close} label="Menu" side="left">
      <div className="drawer__head">
        <p className="micro">HALA.S Clothing</p>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close menu" data-autofocus>
          <IconClose />
        </button>
      </div>

      <nav className="drawer__body" aria-label="Mobile">
        <ul className="menu-list stagger-in" data-open={open}>
          {PRIMARY.map((item, i) => (
            <li key={item.to} style={{ '--i': String(i) } as React.CSSProperties}>
              <Link to={item.to} onClick={close}>
                <span className="display">{item.label}</span>
                <IconArrow className="menu-list__arrow" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="drawer__foot">
        <p className="micro micro--stone">Lahore · By appointment · PKR</p>
      </div>
    </Drawer>
  )
}
