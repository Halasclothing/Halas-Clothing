import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  bulkUpdateOrderStatus,
  getAnalytics,
  listAdminOrders,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type AdminOrder,
  type OrderStatus,
  type PaymentStatus,
} from '../api'
import { csvCell, dateTime, daysAgo, money, number, summariseItems } from '../format'
import { useAsync, useDebounced } from '../hooks'
import {
  ErrorState,
  Field,
  KpiCard,
  Modal,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui'
import { IconDownload, IconSearch } from '../icons'

const download = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const rowsForExport = (orders: AdminOrder[]) =>
  orders.map((order) => ({
    order: order.order_number,
    placed: dateTime(order.placed_at),
    customer: order.customer_name,
    phone: order.phone,
    email: order.email,
    address: `${order.address}, ${order.city} ${order.postal_code}, ${order.country}`,
    items: (order.order_items ?? [])
      .map((item) => `${item.title}${item.size ? ` (${item.size})` : ''} × ${item.quantity}`)
      .join(' | '),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping_fee),
    total: Number(order.total),
    payment: order.payment_status,
    status: order.order_status,
  }))

export function OrdersPage() {
  useDocumentTitle('Orders — HALA.S Admin')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, loading, error, reload } = useAsync(
    () => listAdminOrders({ from: from || undefined, to: to || undefined }),
    [from, to],
  )
  const analytics = useAsync(() => getAnalytics(daysAgo(30), new Date()), [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [payment, setPayment] = useState<PaymentStatus | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('confirmed')
  const [bulkNote, setBulkNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const orders = data ?? []

  const filtered = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    return orders.filter((order) => {
      if (status !== 'all' && order.order_status !== status) return false
      if (payment !== 'all' && order.payment_status !== payment) return false
      if (!term) return true
      return [
        String(order.order_number),
        order.customer_name,
        order.phone,
        order.email,
        order.city,
        order.address,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [orders, status, payment, debounced])

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: orders.length }
    for (const order of orders) base[order.order_status] = (base[order.order_status] ?? 0) + 1
    return base
  }, [orders])

  const allVisibleSelected = filtered.length > 0 && filtered.every((order) => selected.includes(order.id))

  const toggleAll = () => {
    if (allVisibleSelected) setSelected((current) => current.filter((id) => !filtered.some((order) => order.id === id)))
    else setSelected((current) => [...new Set([...current, ...filtered.map((order) => order.id)])])
  }

  const toggleOne = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const exportCsv = () => {
    const rows = rowsForExport(filtered)
    const headers = ['Order', 'Placed', 'Customer', 'Phone', 'Email', 'Address', 'Items', 'Subtotal', 'Shipping', 'Total', 'Payment', 'Status']
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        [row.order, row.placed, row.customer, row.phone, row.email, row.address, row.items, row.subtotal, row.shipping, row.total, row.payment, row.status]
          .map(csvCell)
          .join(','),
      ),
    ].join('\r\n')
    download(`halas-orders-${new Date().toISOString().slice(0, 10)}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8')
  }

  const exportExcel = () => {
    const headers = ['Order', 'Placed', 'Customer', 'Phone', 'Email', 'Address', 'Items', 'Subtotal', 'Shipping', 'Total', 'Payment', 'Status']
    const rows = rowsForExport(filtered)
    const table = `<table border="1"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr>${[row.order, row.placed, row.customer, row.phone, row.email, row.address, row.items, row.subtotal, row.shipping, row.total, row.payment, row.status]
            .map((value) => `<td>${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody></table>`
    download(
      `halas-orders-${new Date().toISOString().slice(0, 10)}.xls`,
      `<html><head><meta charset="utf-8"></head><body>${table}</body></html>`,
      'application/vnd.ms-excel',
    )
  }

  const applyBulk = async () => {
    if (!selected.length) return
    setBusy(true)
    try {
      const updated = await bulkUpdateOrderStatus(selected, bulkStatus, bulkNote)
      setNotice(`${updated} order(s) updated to ${bulkStatus.replace(/_/g, ' ')}. Customer notifications were queued where enabled.`)
      setSelected([])
      setBulkOpen(false)
      setBulkNote('')
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The bulk update could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const stats = analytics.data

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description="Every Cash on Delivery order placed on the storefront appears here. Totals are calculated on the server."
        actions={
          <>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={exportCsv} disabled={!filtered.length}>
              <IconDownload /> CSV
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={exportExcel} disabled={!filtered.length}>
              <IconDownload /> Excel
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

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          <KpiCard label="Today" value={number(stats.today_orders)} hint="Orders placed" />
          <KpiCard label="This week" value={number(stats.week_orders)} hint={money(stats.week_sales)} />
          <KpiCard label="This month" value={number(stats.month_orders)} hint={money(stats.month_sales)} />
          <KpiCard label="Pending / awaiting" value={number(stats.pending + stats.awaiting_dispatch)} tone="warning" />
          <KpiCard label="Out for delivery" value={number(stats.out_for_delivery)} tone="accent" />
          <KpiCard label="Cancelled / returned" value={number(stats.cancelled + stats.returned)} tone={stats.cancelled + stats.returned ? 'danger' : 'neutral'} />
        </div>
      )}

      <div className="admin-toolbar admin-toolbar--wrap">
        <div className="admin-tabs admin-tabs--scroll">
          <button type="button" className={status === 'all' ? 'is-active' : ''} onClick={() => setStatus('all')}>
            All <span>{counts.all}</span>
          </button>
          {ORDER_STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={status === option.value ? 'is-active' : ''}
              onClick={() => setStatus(option.value)}
            >
              {option.label} <span>{counts[option.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="admin-toolbar__right">
          <label className="admin-search">
            <IconSearch />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, customer, phone or city"
              aria-label="Search orders"
            />
          </label>
          <select className="admin-select" value={payment} onChange={(event) => setPayment(event.target.value as PaymentStatus | 'all')} aria-label="Filter by payment status">
            <option value="all">All payments</option>
            {PAYMENT_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="admin-inline-field">
            <span>From</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="admin-inline-field">
            <span>To</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="admin-bulkbar">
          <span>{selected.length} selected</span>
          <div>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as OrderStatus)} aria-label="Bulk target status">
              {ORDER_STATUSES.filter((option) => option.value !== 'new').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={() => setBulkOpen(true)}>
              Apply status
            </button>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {loading && !data && <Spinner label="Loading orders" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="admin-card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--orders">
              <thead>
                <tr>
                  <th className="is-check">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all visible orders" />
                  </th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Delivery</th>
                  <th className="is-right">Items</th>
                  <th className="is-right">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <p className="admin-empty-copy">
                        {orders.length === 0 ? 'No orders in this period yet.' : 'No orders match these filters.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <tr key={order.id}>
                      <td className="is-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(order.id)}
                          onChange={() => toggleOne(order.id)}
                          aria-label={`Select order ${order.order_number}`}
                        />
                      </td>
                      <td>
                        <Link className="admin-link admin-link--strong" to={`/admin/orders/${order.id}`}>
                          #{order.order_number}
                        </Link>
                        <small className="admin-cell-sub">{dateTime(order.placed_at)}</small>
                      </td>
                      <td>
                        {order.customer_name}
                        <small className="admin-cell-sub">{order.phone}</small>
                      </td>
                      <td>
                        {order.city}
                        <small className="admin-cell-sub">{order.address}</small>
                      </td>
                      <td className="is-right">{number(summariseItems(order.order_items))}</td>
                      <td className="is-right">{money(order.total, order.currency)}</td>
                      <td>
                        <StatusBadge value={order.payment_status} />
                      </td>
                      <td>
                        <StatusBadge value={order.order_status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`Update ${selected.length} order${selected.length === 1 ? '' : 's'}`}
        description="Only valid status transitions are accepted. Status changes are recorded in each order history and can queue customer emails."
        footer={
          <>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setBulkOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => void applyBulk()} disabled={busy}>
              {busy ? 'Updating…' : 'Confirm update'}
            </button>
          </>
        }
      >
        <Field label="New status">
          <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as OrderStatus)}>
            {ORDER_STATUSES.filter((option) => option.value !== 'new').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note" hint="Stored in the order history for your team.">
          <input value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} placeholder="Optional internal note" />
        </Field>
      </Modal>
    </>
  )
}
