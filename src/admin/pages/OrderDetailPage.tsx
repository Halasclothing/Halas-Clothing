import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  deliveryOf,
  getAdminOrder,
  getDeliveryEvents,
  getOrderHistory,
  getStoreSettings,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  PAYMENT_STATUSES,
  updateDelivery,
  updateOrderNotes,
  updateOrderPayment,
  updateOrderStatus,
  type AdminDelivery,
  type DeliveryStatus,
  type OrderStatus,
  type PaymentStatus,
  type StoreSettings,
} from '../api'
import { dateOnly, dateTime, money, number } from '../format'
import { useAsync } from '../hooks'
import {
  Card,
  ConfirmDialog,
  ErrorState,
  Field,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui'
import {
  IconArrowLeft,
  IconExternal,
  IconPhone,
  IconPrint,
  IconRefresh,
} from '../icons'
import { invoiceHtml, openPrintDocument, packingSlipHtml, shippingLabelHtml } from '../print'

interface DeliveryDraft {
  courierName: string
  trackingNumber: string
  trackingUrl: string
  dispatchDate: string
  expectedDeliveryDate: string
  deliveryCharges: string
  status: DeliveryStatus | ''
  notes: string
  eventNote: string
}

const blankDelivery: DeliveryDraft = {
  courierName: '',
  trackingNumber: '',
  trackingUrl: '',
  dispatchDate: '',
  expectedDeliveryDate: '',
  deliveryCharges: '',
  status: '',
  notes: '',
  eventNote: '',
}

const deliveryToDraft = (delivery: AdminDelivery | null): DeliveryDraft =>
  delivery
    ? {
        courierName: delivery.courier_name ?? '',
        trackingNumber: delivery.tracking_number ?? '',
        trackingUrl: delivery.tracking_url ?? '',
        dispatchDate: delivery.dispatch_date ?? '',
        expectedDeliveryDate: delivery.expected_delivery_date ?? '',
        deliveryCharges: String(delivery.delivery_charges ?? ''),
        status: delivery.status,
        notes: delivery.notes ?? '',
        eventNote: '',
      }
    : blankDelivery

export function OrderDetailPage() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!id) return null
    const order = await getAdminOrder(id)
    const delivery = deliveryOf(order)
    const [history, events, settings] = await Promise.all([
      getOrderHistory(id),
      delivery ? getDeliveryEvents(delivery.id) : Promise.resolve([]),
      getStoreSettings().catch(() => null),
    ])
    return { order, delivery, history, events, settings: settings as StoreSettings | null }
  }, [id])

  const [internalNotes, setInternalNotes] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [statusTarget, setStatusTarget] = useState<OrderStatus | ''>('')
  const [statusNote, setStatusNote] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<PaymentStatus>('pending')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [delivery, setDelivery] = useState<DeliveryDraft>(blankDelivery)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null)

  useEffect(() => {
    if (!data) return
    setInternalNotes(data.order.internal_notes ?? '')
    setCustomerNotes(data.order.customer_notes ?? '')
    setPaymentTarget(data.order.payment_status)
    setStatusTarget('')
    setDelivery(deliveryToDraft(data.delivery))
  }, [data])

  const order = data?.order
  useDocumentTitle(order ? `Order #${order.order_number} — HALA.S Admin` : 'Order — HALA.S Admin')

  const allowedStatuses = useMemo(
    () => (order ? ORDER_TRANSITIONS[order.order_status] ?? [] : []),
    [order],
  )

  const setDeliveryField = <K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) =>
    setDelivery((current) => ({ ...current, [key]: value }))

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key)
    setNotice(null)
    setProblem(null)
    try {
      await action()
      setNotice(message)
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The action could not be completed.')
    } finally {
      setBusy(null)
    }
  }

  const requestStatusChange = () => {
    if (!statusTarget) {
      setProblem('Choose the new order status.')
      return
    }
    if (statusTarget === 'cancelled' || statusTarget === 'returned') {
      setConfirmStatus(statusTarget)
      return
    }
    void applyStatus(statusTarget)
  }

  const applyStatus = async (target: OrderStatus) => {
    if (!id) return
    setConfirmStatus(null)
    await run(
      'status',
      () => updateOrderStatus(id, target, statusNote),
      `Order status updated to ${target.replace(/_/g, ' ')}.`,
    )
    setStatusNote('')
  }

  const saveNotes = () => {
    if (!id) return
    void run(
      'notes',
      () => updateOrderNotes(id, internalNotes, customerNotes),
      'Order notes saved.',
    )
  }

  const savePayment = () => {
    if (!id) return
    void run(
      'payment',
      () => updateOrderPayment(id, paymentTarget, paymentReference, paymentNote),
      `Payment status updated to ${paymentTarget}.`,
    )
  }

  const saveDelivery = () => {
    if (!id) return
    if (delivery.deliveryCharges !== '' && Number(delivery.deliveryCharges) < 0) {
      setProblem('Delivery charges cannot be negative.')
      return
    }
    void run('delivery', () => updateDelivery(id, delivery), 'Delivery details updated and recorded in the order history.')
  }

  if (loading && !data) return <Spinner label="Loading order" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data || !order) return <ErrorState message="Order not found." />

  const settings = data.settings
  const deliveryRecord = data.delivery
  const items = order.order_items ?? []
  const phoneHref = `tel:${order.phone.replace(/[^+0-9]/g, '')}`
  const canUpdateOrder = allowedStatuses.length > 0

  return (
    <>
      <PageHeader
        eyebrow={`Order #${order.order_number}`}
        title={order.customer_name}
        description={`Placed ${dateTime(order.placed_at)} · Cash on Delivery · ${order.city}`}
        actions={
          <>
            <Link className="admin-btn admin-btn--ghost admin-btn--small" to="/admin/orders">
              <IconArrowLeft /> Orders
            </Link>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--small"
              onClick={() => openPrintDocument(`Invoice ${order.order_number}`, invoiceHtml(order, settings))}
            >
              <IconPrint /> Invoice
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--small"
              onClick={() => openPrintDocument(`Packing slip ${order.order_number}`, packingSlipHtml(order, settings))}
            >
              <IconPrint /> Packing slip
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--small"
              onClick={() => openPrintDocument(`Shipping label ${order.order_number}`, shippingLabelHtml(order, deliveryRecord, settings))}
            >
              <IconPrint /> Label
            </button>
            <button type="button" className="admin-icon-btn" onClick={reload} title="Refresh order" aria-label="Refresh order">
              <IconRefresh />
            </button>
          </>
        }
      />

      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {problem && (
        <Notice tone="error" onDismiss={() => setProblem(null)}>
          {problem}
        </Notice>
      )}

      <div className="order-badges">
        <StatusBadge value={order.order_status} />
        <StatusBadge value={order.payment_status} />
        {deliveryRecord && <StatusBadge value={deliveryRecord.status} />}
        {order.stock_deducted ? (
          <span className="badge badge--neutral">Stock deducted</span>
        ) : order.stock_reserved ? (
          <span className="badge badge--warning">Stock reserved</span>
        ) : null}
      </div>

      <div className="order-grid">
        <div className="order-grid__main">
          <Card title={`Items · ${number(items.reduce((total, item) => total + item.quantity, 0))}`} flush>
            <div className="admin-table-wrap">
              <table className="admin-table order-items">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="is-right">Unit price</th>
                    <th className="is-right">Qty</th>
                    <th className="is-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="admin-product-cell">
                          {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <span className="admin-thumb-fallback" />}
                          <div>
                            <strong>{item.title}</strong>
                            <small className="admin-cell-sub">
                              {[item.colour, item.size].filter(Boolean).join(' · ') || item.variant_title || '—'}
                              {item.sku ? ` · SKU ${item.sku}` : ''}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="is-right">{money(item.unit_price, order.currency)}</td>
                      <td className="is-right">{number(item.quantity)}</td>
                      <td className="is-right">{money(item.line_total, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(order.subtotal, order.currency)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{money(order.shipping_fee, order.currency)}</strong>
              </div>
              {Number(order.tax_total) > 0 && (
                <div>
                  <span>Tax</span>
                  <strong>{money(order.tax_total, order.currency)}</strong>
                </div>
              )}
              {Number(order.discount_total) > 0 && (
                <div>
                  <span>Discount</span>
                  <strong>-{money(order.discount_total, order.currency)}</strong>
                </div>
              )}
              <div className="order-totals__grand">
                <span>Total due</span>
                <strong>{money(order.total, order.currency)}</strong>
              </div>
            </div>
          </Card>

          <Card
            title="Delivery"
            description="Courier and tracking details are entered manually. No live courier integration is connected."
          >
            <div className="admin-form-grid">
              <Field label="Courier">
                <input value={delivery.courierName} onChange={(event) => setDeliveryField('courierName', event.target.value)} placeholder="e.g. Leopards Courier" />
              </Field>
              <Field label="Tracking number">
                <input value={delivery.trackingNumber} onChange={(event) => setDeliveryField('trackingNumber', event.target.value)} placeholder="Courier tracking reference" />
              </Field>
              <Field label="Tracking URL" hint="Optional. Opens the courier's own tracking page.">
                <input value={delivery.trackingUrl} onChange={(event) => setDeliveryField('trackingUrl', event.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Delivery status">
                <select value={delivery.status} onChange={(event) => setDeliveryField('status', event.target.value as DeliveryStatus | '')}>
                  <option value="">No status change</option>
                  {(['pending', 'ready_to_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 'cancelled'] as DeliveryStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dispatch date">
                <input type="date" value={delivery.dispatchDate} onChange={(event) => setDeliveryField('dispatchDate', event.target.value)} />
              </Field>
              <Field label="Expected delivery">
                <input type="date" value={delivery.expectedDeliveryDate} onChange={(event) => setDeliveryField('expectedDeliveryDate', event.target.value)} />
              </Field>
              <Field label="Delivery charges (PKR)" hint="Recorded separately from the order shipping fee.">
                <input inputMode="decimal" value={delivery.deliveryCharges} onChange={(event) => setDeliveryField('deliveryCharges', event.target.value)} />
              </Field>
              <Field label="Delivery notes">
                <input value={delivery.notes} onChange={(event) => setDeliveryField('notes', event.target.value)} placeholder="Instructions for the courier" />
              </Field>
              <Field label="Status event note" className="is-span-2">
                <input value={delivery.eventNote} onChange={(event) => setDeliveryField('eventNote', event.target.value)} placeholder="Shown in the delivery event history" />
              </Field>
            </div>
            <div className="editor-actions">
              <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={saveDelivery} disabled={busy === 'delivery'}>
                {busy === 'delivery' ? 'Saving…' : 'Save delivery details'}
              </button>
              {deliveryRecord?.tracking_url && (
                <a className="admin-btn admin-btn--ghost admin-btn--small" href={deliveryRecord.tracking_url} target="_blank" rel="noreferrer">
                  <IconExternal /> Courier tracking
                </a>
              )}
            </div>
            {deliveryRecord && (
              <p className="admin-muted" style={{ marginTop: '0.9rem' }}>
                Last updated {dateTime(deliveryRecord.updated_at)}
                {deliveryRecord.dispatch_date ? ` · dispatched ${dateOnly(deliveryRecord.dispatch_date)}` : ''}
                {deliveryRecord.expected_delivery_date ? ` · expected ${dateOnly(deliveryRecord.expected_delivery_date)}` : ''}
              </p>
            )}
          </Card>

          <Card title="History" description="Order status, payment and delivery events with timestamps and actors.">
            <div className="order-history">
              <section>
                <p className="admin-eyebrow">Order</p>
                {data.history.length === 0 ? (
                  <p className="admin-muted">No order history yet.</p>
                ) : (
                  <ul className="timeline">
                    {data.history.map((entry) => (
                      <li key={entry.id}>
                        <span className="timeline__dot" aria-hidden="true" />
                        <div>
                          <strong>
                            {entry.field === 'note'
                              ? 'Internal note updated'
                              : `${entry.field.replace(/_/g, ' ')}: ${entry.from_value ?? '—'} → ${entry.to_value ?? '—'}`}
                          </strong>
                          {entry.note && <p>{entry.note}</p>}
                          <small>
                            {entry.actor_email || 'System'} · {dateTime(entry.created_at)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <p className="admin-eyebrow">Delivery</p>
                {data.events.length === 0 ? (
                  <p className="admin-muted">No delivery events yet.</p>
                ) : (
                  <ul className="timeline">
                    {data.events.map((event) => (
                      <li key={event.id}>
                        <span className="timeline__dot" aria-hidden="true" />
                        <div>
                          <strong>{event.status.replace(/_/g, ' ')}</strong>
                          {event.note && <p>{event.note}</p>}
                          <small>
                            {event.actor_email || 'System'} · {dateTime(event.created_at)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </Card>
        </div>

        <aside className="order-grid__aside">
          <Card title="Customer">
            <dl className="admin-summary-list">
              <div>
                <dt>Name</dt>
                <dd>{order.customer_name}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a className="admin-link" href={phoneHref}>
                    <IconPhone /> {order.phone}
                  </a>
                </dd>
              </div>
              {order.email && (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a className="admin-link" href={`mailto:${order.email}`}>
                      {order.email}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt>Address</dt>
                <dd className="is-preline">
                  {order.address}
                  {'\n'}
                  {order.city} {order.postal_code}
                  {'\n'}
                  {order.country}
                </dd>
              </div>
              {order.customer_id && (
                <div>
                  <dt>Profile</dt>
                  <dd>
                    <Link className="admin-link" to={`/admin/customers/${order.customer_id}`}>
                      View customer history
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Fulfilment">
            <Field label="Order status" hint={canUpdateOrder ? 'Only valid transitions are accepted.' : 'This order reached a final status.'}>
              <select
                value={statusTarget}
                onChange={(event) => setStatusTarget(event.target.value as OrderStatus | '')}
                disabled={!canUpdateOrder}
              >
                <option value="">{canUpdateOrder ? 'Choose the next status' : 'No further transitions'}</option>
                {allowedStatuses.map((value) => (
                  <option key={value} value={value}>
                    {ORDER_STATUSES.find((option) => option.value === value)?.label ?? value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status note">
              <input value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Optional note for the history" />
            </Field>
            <button
              type="button"
              className="admin-btn admin-btn--primary admin-btn--small"
              onClick={requestStatusChange}
              disabled={!canUpdateOrder || busy === 'status'}
            >
              {busy === 'status' ? 'Updating…' : 'Update order status'}
            </button>
            <p className="admin-muted">
              Confirming reserves stock, later statuses deduct it, and cancellation or return restores it according to
              store settings.
            </p>
          </Card>

          <Card title="Payment">
            <dl className="admin-summary-list">
              <div>
                <dt>Method</dt>
                <dd>Cash on Delivery</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><StatusBadge value={order.payment_status} /></dd>
              </div>
              {order.delivered_at && (
                <div>
                  <dt>Delivered</dt>
                  <dd>{dateTime(order.delivered_at)}</dd>
                </div>
              )}
            </dl>
            <Field label="Payment status">
              <select value={paymentTarget} onChange={(event) => setPaymentTarget(event.target.value as PaymentStatus)}>
                {PAYMENT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference">
              <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Receipt or remittance reference" />
            </Field>
            <Field label="Note">
              <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
            </Field>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={savePayment} disabled={busy === 'payment'}>
              {busy === 'payment' ? 'Saving…' : 'Update payment'}
            </button>
          </Card>

          <Card title="Notes">
            <Field label="Internal note" hint="Private to administrators.">
              <textarea rows={3} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
            </Field>
            <Field label="Customer note" hint="Visible to the customer in their order communication.">
              <textarea rows={3} value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} />
            </Field>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={saveNotes} disabled={busy === 'notes'}>
              {busy === 'notes' ? 'Saving…' : 'Save notes'}
            </button>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(confirmStatus)}
        title={confirmStatus === 'cancelled' ? 'Cancel this order?' : 'Mark this order returned?'}
        body={
          confirmStatus === 'cancelled'
            ? 'The order will be cancelled. Reserved or deducted stock will be restored if the store settings allow it. Customer notifications are queued where enabled.'
            : 'The order will be marked returned and stock will be restored if the store settings allow it. This is recorded in the order history.'
        }
        confirmLabel={confirmStatus === 'cancelled' ? 'Cancel order' : 'Mark returned'}
        busy={busy === 'status'}
        onConfirm={() => confirmStatus && void applyStatus(confirmStatus)}
        onClose={() => setConfirmStatus(null)}
      />
    </>
  )
}
