import { Link } from 'react-router-dom'
import { Drawer } from './Drawer'
import { useCart } from '../state/cart'
import { useUi } from '../state/ui'
import { formatPrice } from '../data/format'
import { EditorialImage } from './EditorialFrame'
import { IconArrow, IconClose, IconMinus, IconPlus } from './Icons'

export function CartDrawer() {
  const { isOpen, close, announce } = useUi()
  const open = isOpen('cart')
  const cart = useCart()

  return (
    <Drawer open={open} onClose={close} label="Shopping bag">
      <div className="drawer__head">
        <p className="micro">
          Your bag{' '}
          <span className="visually-hidden">contains {cart.count} {cart.count === 1 ? 'item' : 'items'}</span>
        </p>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close bag" data-autofocus>
          <IconClose />
        </button>
      </div>

      <div className="drawer__body">
        {cart.lines.length === 0 ? (
          <div className="state">
            <p className="display display--lg">Nothing here yet.</p>
            <p className="notice">Pieces you add are kept in this bag on this device.</p>
            <Link className="btn btn--solid" to="/collections/all" onClick={close}>
              Browse the edit <IconArrow />
            </Link>
          </div>
        ) : (
          <ul className="stagger-in" data-open={open}>
            {cart.lines.map((line, i) => (
              <li className="line" style={{ '--i': String(i) } as React.CSSProperties} key={line.key}>
                <Link to={`/product/${line.product.handle}`} onClick={close} aria-label={`View ${line.product.title}`}>
                  <span className="frame frame--portrait" style={{ display: 'block' }}>
                    <EditorialImage img={line.product.images[0]} sizes="68px" />
                  </span>
                </Link>
                <div>
                  <p className="card__title" style={{ fontSize: '1rem' }}>
                    <Link to={`/product/${line.product.handle}`} onClick={close}>
                      {line.product.title}
                    </Link>
                  </p>
                  <p className="micro micro--stone" style={{ marginTop: '0.35rem' }}>
                    {line.colour || line.product.colourName} · Size {line.size} ·{' '}
                    {formatPrice(line.unitPrice)}
                  </p>
                  <div className="stepper" style={{ marginTop: '0.7rem' }}>
                    <button
                      type="button"
                      onClick={() => cart.setQuantity(line.key, line.quantity - 1)}
                      aria-label={`Decrease quantity of ${line.product.title}`}
                    >
                      <IconMinus />
                    </button>
                    <output aria-label={`Quantity of ${line.product.title}`}>{line.quantity}</output>
                    <button
                      type="button"
                      onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                      aria-label={`Increase quantity of ${line.product.title}`}
                    >
                      <IconPlus />
                    </button>
                  </div>
                </div>
                <div className="line__actions">
                  <span>{formatPrice(line.lineTotal)}</span>
                  <button
                    type="button"
                    className="micro link-sweep"
                    aria-label={`Remove ${line.product.title} size ${line.size} from bag`}
                    onClick={() => {
                      cart.remove(line.key)
                      announce(`${line.product.title} removed from bag`)
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.lines.length > 0 && (
        <div className="drawer__foot">
          <div className="total">
            <span className="micro">Subtotal</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <p className="notice" id="checkout-note">
            Cash on Delivery is available. Complete your delivery details on the next step to place your order.
          </p>
          <div className="buy-row">
            <Link
              to="/checkout"
              className="btn btn--solid checkout-proceed"
              aria-describedby="checkout-note"
              onClick={close}
            >
              Proceed to checkout <IconArrow />
            </Link>
            <Link to="/cart" className="btn btn--ghost" onClick={close}>
              View full bag
            </Link>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Continue shopping
            </button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
