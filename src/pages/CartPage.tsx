import { Link } from 'react-router-dom'
import { useCart } from '../state/cart'
import { formatPrice } from '../data/format'
import { EditorialImage } from '../components/EditorialFrame'
import { IconArrow, IconMinus, IconPlus } from '../components/Icons'

export function CartPage() {
  const cart = useCart()

  return (
    <section className="cart-page editorial-page">
      <div className="checkout-heading">
        <p className="micro">HALA.S · YOUR BAG</p>
        <h1 className="editorial-title">Shopping bag.</h1>
        <p className="editorial-lede">Review your selected pieces before entering your delivery details.</p>
      </div>

      {cart.lines.length === 0 ? (
        <div className="checkout-card cart-empty">
          <h2>Your bag is empty.</h2>
          <p className="checkout-small">Explore the collection and add a piece to continue.</p>
          <Link className="btn btn--solid" to="/collections/all">Explore the collection <IconArrow /></Link>
        </div>
      ) : (
        <div className="cart-page__layout">
          <div className="checkout-card cart-page__items">
            {cart.lines.map((line) => (
              <article className="cart-page__item" key={line.key}>
                <Link to={`/product/${line.product.handle}`} className="cart-page__image">
                  <EditorialImage img={line.product.images[0]} sizes="120px" />
                </Link>
                <div className="cart-page__details">
                  <Link to={`/product/${line.product.handle}`} className="cart-page__title">{line.product.title}</Link>
                  <p className="checkout-small">
                    {line.colour || line.product.colourName} · Size {line.size}
                  </p>
                  <strong>{formatPrice(line.unitPrice)}</strong>
                  <div className="stepper cart-page__stepper">
                    <button type="button" onClick={() => cart.setQuantity(line.key, line.quantity - 1)} aria-label={`Decrease ${line.product.title}`}><IconMinus /></button>
                    <output>{line.quantity}</output>
                    <button type="button" onClick={() => cart.setQuantity(line.key, line.quantity + 1)} aria-label={`Increase ${line.product.title}`}><IconPlus /></button>
                  </div>
                  <button className="link-sweep cart-page__remove" type="button" onClick={() => cart.remove(line.key)}>Remove</button>
                </div>
                <strong className="cart-page__line-total">{formatPrice(line.lineTotal)}</strong>
              </article>
            ))}
          </div>

          <aside className="checkout-card cart-page__summary">
            <h2>Order summary</h2>
            <div className="checkout-total"><span>Subtotal</span><strong>{formatPrice(cart.subtotal)}</strong></div>
            <div className="checkout-total"><span>Payment</span><strong>Cash on Delivery</strong></div>
            <p className="checkout-small">Delivery charges, if applicable, will be confirmed by HALA.S before dispatch.</p>
            <Link className="btn btn--solid cart-page__checkout" to="/checkout">Proceed to checkout <IconArrow /></Link>
            <Link className="checkout-back" to="/collections/all">Continue shopping</Link>
          </aside>
        </div>
      )}
    </section>
  )
}
