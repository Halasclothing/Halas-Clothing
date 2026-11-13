import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { getCustomerDetail, updateCustomer } from '../api'
import { dateOnly, money, number } from '../format'
import { useAsync } from '../hooks'
import {
  Card,
  ErrorState,
  Field,
  KpiCard,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui'
import { IconArrowLeft, IconMail, IconPhone } from '../icons'

interface ContactDraft {
  name: string
  email: string
  phone: string
  notes: string
}

const blankContact: ContactDraft = { name: '', email: '', phone: '', notes: '' }

const ACTIONABLE = new Set(['cancelled', 'returned'])

export function CustomerDetailPage() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!id) return null
    return getCustomerDetail(id)
  }, [id])

  const [contact, setContact] = useState<ContactDraft>(blankContact)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setContact({
      name: data.customer.name ?? '',
      email: data.customer.email ?? '',
      phone: data.customer.phone ?? '',
      notes: data.customer.notes ?? '',
    })
  }, [data])

  useDocumentTitle(data ? `${data.customer.name} — HALA.S Admin` : 'Customer — HALA.S Admin')

  const stats = useMemo(() => {
    const orders = data?.orders ?? []
    const counted = orders.filter((order) => !ACTIONABLE.has(order.order_status))
    const spend = counted.reduce((total, order) => total + Number(order.total || 0), 0)
    return {
      orders: orders.length,
      spend,
      average: counted.length ? spend / counted.length : 0,
      last: orders[0]?.placed_at ?? null,
    }
  }, [data])

  const setField = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) =>
    setContact((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (!id) return
    if (!contact.name.trim() || !contact.phone.trim()) {
      setProblem('A customer needs a name and a phone number.')
      return
    }
    setBusy(true)
    setNotice(null)
    setProblem(null)
    try {
      await updateCustomer(id, {
        name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        notes: contact.notes.trim(),
      })
      setNotice('Customer profile saved.')
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The customer could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <Spinner label="Loading customer" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <ErrorState message="This customer could not be found." onRetry={reload} />

  const { customer, addresses, orders } = data
  const whatsapp = customer.phone.replace(/[^\d]/g, '')

  return (
    <>
      <Link className="admin-back" to="/admin/customers">
        <IconArrowLeft /> All customers
      </Link>

      <PageHeader
        eyebrow="Customer"
        title={customer.name}
        description={`Customer since ${dateOnly(customer.created_at)} · ${number(stats.orders)} order${stats.orders === 1 ? '' : 's'} · ${money(stats.spend)} lifetime spend`}
        actions={
          <div className="admin-head-actions">
            <a className="admin-btn admin-btn--ghost" href={`tel:${customer.phone}`}>
              <IconPhone /> Call
            </a>
            {customer.email && (
              <a className="admin-btn admin-btn--ghost" href={`mailto:${customer.email}`}>
                <IconMail /> Email
              </a>
            )}
            {whatsapp && (
              <a
                className="admin-btn admin-btn--ghost"
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            )}
          </div>
        }
      />

      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem}</Notice>}

      <div className="kpi-grid kpi-grid--compact">
        <KpiCard label="Orders placed" value={number(stats.orders)} />
        <KpiCard label="Lifetime spend" value={money(stats.spend)} hint="Excludes cancelled and returned orders" />
        <KpiCard label="Average order" value={money(stats.average)} />
        <KpiCard label="Last order" value={stats.last ? dateOnly(stats.last) : '—'} />
      </div>

      <div className="admin-split">
        <div className="admin-split__main">
          <Card
            title="Order history"
            description={
              orders.length
                ? 'Every order placed with this phone number or email.'
                : 'No orders are linked to this profile yet.'
            }
            flush
          >
            {orders.length === 0 ? (
              <div className="admin-empty-inline">
                <p className="admin-empty-copy">No order history to show.</p>
                <Link className="admin-link" to="/admin/orders">
                  Browse all orders
                </Link>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th className="is-right">Items</th>
                      <th className="is-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link className="admin-link admin-link--strong" to={`/admin/orders/${order.id}`}>
                            #{order.order_number}
                          </Link>
                        </td>
                        <td>{dateOnly(order.placed_at)}</td>
                        <td>
                          <StatusBadge value={order.order_status} />
                        </td>
                        <td>
                          <StatusBadge value={order.payment_status} />
                        </td>
                        <td className="is-right">{number(order.order_items?.length ?? 0)}</td>
                        <td className="is-right">{money(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Saved addresses">
            {addresses.length === 0 ? (
              <p className="admin-muted">No saved addresses. The shipping address is captured on each order.</p>
            ) : (
              <ul className="admin-address-list">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <strong>{address.label || 'Address'}</strong>
                    <span>{address.address}</span>
                    <span>
                      {[address.city, address.postal_code, address.country].filter(Boolean).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="admin-split__side">
          <Card title="Contact details" description="Used on invoices, packing slips and order emails.">
            <div className="admin-form-grid">
              <Field label="Full name">
                <input
                  className="admin-input"
                  value={contact.name}
                  onChange={(event) => setField('name', event.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field label="Phone" hint="Primary identifier — customers may checkout as guests.">
                <input
                  className="admin-input"
                  value={contact.phone}
                  onChange={(event) => setField('phone', event.target.value)}
                  autoComplete="tel"
                />
              </Field>
              <Field label="Email" hint="Optional. Required for transactional email.">
                <input
                  className="admin-input"
                  type="email"
                  value={contact.email}
                  onChange={(event) => setField('email', event.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Internal notes" hint="Only visible to administrators — never shown to the customer.">
                <textarea
                  className="admin-input admin-textarea"
                  rows={4}
                  value={contact.notes}
                  onChange={(event) => setField('notes', event.target.value)}
                  placeholder="Preferences, delivery instructions, follow-ups…"
                />
              </Field>
            </div>
            <div className="admin-form-actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </Card>

          <Card title="Consent & privacy">
            <dl className="admin-facts">
              <div>
                <dt>Marketing email</dt>
                <dd>
                  <StatusBadge value={customer.accepts_marketing ? 'active' : 'draft'} />
                  <span className="admin-muted">
                    {customer.accepts_marketing
                      ? 'The customer opted in to marketing.'
                      : 'No marketing consent — transactional email only.'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{dateOnly(customer.created_at)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{dateOnly(customer.updated_at)}</dd>
              </div>
            </dl>
            <p className="admin-field__hint">
              Contact details and notes are protected by row-level security and are readable by administrators only.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}
