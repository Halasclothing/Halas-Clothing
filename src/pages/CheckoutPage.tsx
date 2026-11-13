import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../state/cart'
import { formatPrice } from '../data/format'
import { backendReady, submitCodOrder } from '../data/backend'
import { fetchStorefrontSettings } from '../data/live'
import { shippingFor, type StorefrontSettings } from '../data/settings'
import { EditorialImage } from '../components/EditorialFrame'

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export function CheckoutPage() {
  const cart = useCart()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal: '',
    notes: '',
  })
  const [settings, setSettings] = useState<StorefrontSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<{ number: number; total: number } | null>(null)
  const [idempotencyKey] = useState(newKey)

  useEffect(() => {
    let active = true
    fetchStorefrontSettings().then((value) => active && setSettings(value)).catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const update = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }))

  const shipping = settings ? shippingFor(cart.subtotal, settings) : 0
  const total = useMemo(() => cart.subtotal + shipping, [cart.subtotal, shipping])
  const codDisabled = settings?.codEnabled === false

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!backendReady) {
      setError('Online ordering is not configured yet. Please contact HALA.S support before placing an order.')
      return
    }
    if (codDisabled) {
      setError('Cash on Delivery is temporarily unavailable. Please contact HALA.S support.')
      return
    }
    if (!cart.lines.length) {
      setError('Your bag is empty. Add an available item before checking out.')
      return
    }
    const phoneDigits = form.phone.replace(/\D/g, '')
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setError('Please enter a valid phone number, including your country code if applicable.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // The database re-checks live prices, publication status, variant
      // availability and stock under a row lock. Browser prices are ignored.
      const result = await submitCodOrder({
        customer_name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        postal_code: form.postal.trim(),
        notes: form.notes.trim(),
        idempotency_key: idempotencyKey,
        items: cart.lines.map((line) => ({
          handle: line.product.handle,
          size: line.size === 'One size' ? '' : line.size,
          colour: line.colour,
          variant_id: line.variantId,
          quantity: line.quantity,
        })),
      })
      setOrder({ number: result.order_number, total: result.total })
      cart.clear()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your order could not be submitted. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (order) {
    return (
      <div className="checkout-page editorial-page">
        <div className="checkout-card checkout-success">
          <p className="micro">HALA.S · ORDER RECEIVED</p>
          <h1 className="editorial-title">Thank you.</h1>
          <p>
            Your order <strong>#{order.number}</strong> has been submitted successfully with Cash on
            Delivery for <strong>{formatPrice(order.total)}</strong>.
          </p>
          <p>
            Our team will contact you to confirm the order before dispatch. A confirmation email has
            been sent if you provided an email address.
          </p>
          <Link className="btn btn--solid" to="/">
            Continue shopping
          </Link>
        </div>
      </div>
    )
  }

  if (!cart.lines.length) {
    return (
      <div className="checkout-page editorial-page">
        <div className="checkout-card">
          <p className="micro">YOUR BAG</p>
          <h1 className="editorial-title">Nothing to checkout.</h1>
          <p className="checkout-small">
            Your shopping bag is empty. Browse the collection to add an item.
          </p>
          <Link className="btn btn--solid" to="/collections/all">
            Explore the collection
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="checkout-page editorial-page">
      <div className="checkout-heading">
        <p className="micro">HALA.S · SECURE ORDER</p>
        <h1 className="editorial-title">Checkout.</h1>
        <div className="checkout-steps">
          <span className="is-complete">01 · Bag</span>
          <i />
          <span className="is-current">02 · Delivery details</span>
          <i />
          <span>03 · COD confirmation</span>
        </div>
        <p className="editorial-lede">
          Enter your delivery details, review your items and place your Cash on Delivery order.
        </p>
      </div>
      {!backendReady && (
        <p className="checkout-error" role="alert">
          Checkout is not connected yet. HALA.S must finish its secure store configuration before
          orders can be accepted.
        </p>
      )}
      {codDisabled && (
        <p className="checkout-error" role="alert">
          Cash on Delivery is temporarily unavailable. Please contact HALA.S support.
        </p>
      )}
      <div className="checkout-layout">
        <form className="checkout-card checkout-form" onSubmit={placeOrder}>
          <h2>Delivery details</h2>
          <label>
            Full name
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <div className="checkout-two">
            <label>
              Phone number
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                minLength={7}
                maxLength={24}
                pattern="[+0-9() .-]{7,24}"
                title="Enter a valid phone number, including country code if applicable."
                placeholder="+92 3XX XXXXXXX"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </label>
            <label>
              Email address <span className="checkout-optional">Recommended</span>
              <input
                type="email"
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </label>
          </div>
          <label>
            Street address
            <textarea
              required
              minLength={8}
              maxLength={500}
              rows={3}
              autoComplete="street-address"
              placeholder="House number, street, area and nearby landmark"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
            />
          </label>
          <div className="checkout-two">
            <label>
              City
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="address-level2"
                placeholder="Your city"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </label>
            <label>
              Postal code <span className="checkout-optional">Optional</span>
              <input
                maxLength={20}
                autoComplete="postal-code"
                placeholder="e.g. 54000"
                value={form.postal}
                onChange={(e) => update('postal', e.target.value)}
              />
            </label>
          </div>
          <label>
            Order notes <span className="checkout-optional">Optional</span>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Delivery instructions (optional)"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </label>
          <div className="checkout-payment">
            <span className="micro">PAYMENT METHOD</span>
            <strong>Cash on Delivery (COD)</strong>
            <p>Pay in cash when your order is delivered. No card or online payment is required.</p>
          </div>
          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn btn--solid checkout-submit"
            type="submit"
            disabled={busy || codDisabled}
            aria-busy={busy}
          >
            {busy ? 'Submitting order…' : `Place COD order — ${formatPrice(total)}`}
          </button>
          <p className="checkout-small">
            By placing this order, you confirm that your delivery details are correct. Our team may
            contact you to verify the order.
          </p>
        </form>
        <aside className="checkout-card checkout-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          {cart.lines.map((line) => (
            <div className="checkout-item" key={line.key}>
              <div className="checkout-thumb">
                <EditorialImage img={line.product.images[0]} sizes="72px" />
              </div>
              <div>
                <strong>{line.product.title}</strong>
                <small>
                  {line.colour ? `${line.colour} · ` : ''}
                  {line.size === 'One size' ? 'One size' : `Size ${line.size}`} · Qty {line.quantity}
                </small>
              </div>
              <b>{formatPrice(line.lineTotal)}</b>
            </div>
          ))}
          <div className="checkout-total">
            <span>Subtotal</span>
            <strong>{formatPrice(cart.subtotal)}</strong>
          </div>
          <div className="checkout-total">
            <span>Delivery fee</span>
            <strong>{shipping > 0 ? formatPrice(shipping) : 'Free'}</strong>
          </div>
          <div className="checkout-total checkout-grand">
            <span>Total due on delivery</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <p className="checkout-small">
            Pay the full amount in cash when your order arrives. Delivery charges are calculated from
            the store settings and confirmed before dispatch.
          </p>
          <Link className="checkout-back" to="/collections/all">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  )
}
