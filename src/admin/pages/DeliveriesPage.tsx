import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  DELIVERY_STATUSES,
  getDeliveryEvents,
  getStoreSettings,
  listDeliveries,
  updateDelivery,
  type AdminDeliveryRow,
  type DeliveryStatus,
  type StoreSettings,
} from '../api'
import { dateOnly, dateTime, money, number, titleCase } from '../format'
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
import { IconExternal, IconPhone, IconPrint, IconSearch } from '../icons'
import { openPrintDocument, packingSlipHtml, shippingLabelHtml } from '../print'

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

export function DeliveriesPage() {
  useDocumentTitle('Deliveries — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(async () => {
    const [rows, settings] = await Promise.all([listDeliveries(), getStoreSettings().catch(() => null)])
    return { rows, settings: settings as StoreSettings | null }
  }, [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [status, setStatus] = useState<DeliveryStatus | 'all'>('all')
  const [editing, setEditing] = useState<AdminDeliveryRow | null>(null)
  const [draft, setDraft] = useState<DeliveryDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<AdminDeliveryRow | null>(null)
  const [events, setEvents] = useState<{ id: string; status: string; note: string; actor_email: string; created_at: string }[] | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)

  const rows = data?.rows ?? []
  const settings = data?.settings ?? null

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: rows.length }
    for (const row of rows) base[row.delivery.status] = (base[row.delivery.status] ?? 0) + 1
    return base
  }, [rows])

  const visible = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    return rows.filter((row) => {
      if (status !== 'all' && row.delivery.status !== status) return false
      if (!term) return true
      return [
        String(row.order?.order_number ?? ''),
        row.order?.customer_name ?? '',
        row.order?.phone ?? '',
        row.order?.city ?? '',
        row.delivery.courier_name,
        row.delivery.tracking_number,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [rows, status, debounced])

  const openEditor = (row: AdminDeliveryRow) => {
    setEditing(row)
    setProblem(null)
    setDraft({
      courierName: row.delivery.courier_name ?? '',
      trackingNumber: row.delivery.tracking_number ?? '',
      trackingUrl: row.delivery.tracking_url ?? '',
      dispatchDate: row.delivery.dispatch_date ?? '',
      expectedDeliveryDate: row.delivery.expected_delivery_date ?? '',
      deliveryCharges: String(row.delivery.delivery_charges ?? ''),
      status: row.delivery.status,
      notes: row.delivery.notes ?? '',
      eventNote: '',
    })
  }

  const setField = <K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current))

  const save = async () => {
    if (!editing || !draft) return
    if (draft.deliveryCharges !== '' && Number(draft.deliveryCharges) < 0) {
      setProblem('Delivery charges cannot be negative.')
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await updateDelivery(editing.order.id, draft)
      setNotice(`Delivery for order #${editing.order.order_number} updated.`)
      setEditing(null)
      setDraft(null)
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The delivery could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  const openHistory = async (row: AdminDeliveryRow) => {
    setHistoryFor(row)
    setEvents(null)
    setHistoryBusy(true)
    try {
      setEvents(await getDeliveryEvents(row.delivery.id))
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The delivery history could not be loaded.')
    } finally {
      setHistoryBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Deliveries"
        description="Dispatch, tracking and delivery outcomes for every order. Tracking details are entered manually — this is not a live courier feed."
        actions={
          <button type="button" className="admin-btn admin-btn--ghost" onClick={reload}>
            Refresh
          </button>
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

      <div className="kpi-grid kpi-grid--compact">
        <KpiCard label="Pending dispatch" value={number((counts.pending ?? 0) + (counts.ready_to_dispatch ?? 0))} tone="warning" />
        <KpiCard label="In transit" value={number((counts.shipped ?? 0) + (counts.out_for_delivery ?? 0))} tone="accent" />
        <KpiCard label="Delivered" value={number(counts.delivered ?? 0)} tone="success" />
        <KpiCard label="Failed / returned" value={number((counts.failed_delivery ?? 0) + (counts.returned ?? 0))} tone="danger" />
        <KpiCard label="All deliveries" value={number(rows.length)} />
      </div>

      <div className="admin-toolbar admin-toolbar--wrap">
        <div className="admin-tabs admin-tabs--scroll">
          <button type="button" className={status === 'all' ? 'is-active' : ''} onClick={() => setStatus('all')}>
            All <span>{counts.all}</span>
          </button>
          {DELIVERY_STATUSES.map((option) => (
            <button key={option.value} type="button" className={status === option.value ? 'is-active' : ''} onClick={() => setStatus(option.value)}>
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
              placeholder="Search order, recipient, phone, courier or tracking"
              aria-label="Search deliveries"
            />
          </label>
        </div>
      </div>

      {loading && !data && <Spinner label="Loading deliveries" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="admin-card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--deliveries">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Recipient</th>
                  <th>Courier / tracking</th>
                  <th>Dispatch</th>
                  <th>Expected</th>
                  <th>Status</th>
                  <th className="is-right">Charges</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <p className="admin-empty-copy">
                        {rows.length === 0 ? 'No deliveries yet. Every website order creates a delivery record.' : 'No deliveries match these filters.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => (
                    <tr key={row.delivery.id}>
                      <td>
                        <Link className="admin-link admin-link--strong" to={`/admin/orders/${row.order.id}`}>
                          #{row.order.order_number}
                        </Link>
                        <small className="admin-cell-sub">{dateTime(row.order.placed_at)}</small>
                      </td>
                      <td>
                        {row.order.customer_name}
                        <small className="admin-cell-sub">
                          <a className="admin-link" href={`tel:${row.order.phone.replace(/[^+0-9]/g, '')}`}>
                            <IconPhone /> {row.order.phone}
                          </a>
                        </small>
                        <small className="admin-cell-sub">{row.order.city} · {money(row.order.total, row.order.currency)} COD</small>
                      </td>
                      <td>
                        {row.delivery.courier_name || '—'}
                        <small className="admin-cell-sub">{row.delivery.tracking_number || 'No tracking yet'}</small>
                      </td>
                      <td>{row.delivery.dispatch_date ? dateOnly(row.delivery.dispatch_date) : '—'}</td>
                      <td>{row.delivery.expected_delivery_date ? dateOnly(row.delivery.expected_delivery_date) : '—'}</td>
                      <td>
                        <StatusBadge value={row.delivery.status} />
                      </td>
                      <td className="is-right">{money(row.delivery.delivery_charges)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => openEditor(row)}>
                            Update
                          </button>
                          <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => void openHistory(row)}>
                            History
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="Print packing slip"
                            aria-label={`Print packing slip for order ${row.order.order_number}`}
                            onClick={() => openPrintDocument(`Packing slip ${row.order.order_number}`, packingSlipHtml(row.order, settings))}
                          >
                            <IconPrint />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="Print shipping label"
                            aria-label={`Print shipping label for order ${row.order.order_number}`}
                            onClick={() => openPrintDocument(`Shipping label ${row.order.order_number}`, shippingLabelHtml(row.order, row.delivery, settings))}
                          >
                            <IconExternal />
                          </button>
                        </div>
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
        open={Boolean(editing)}
        onClose={() => {
          setEditing(null)
          setDraft(null)
        }}
        title={editing ? `Delivery · Order #${editing.order.order_number}` : 'Delivery'}
        description="Changing the delivery status also synchronises the order status in the order engine."
        wide
        footer={
          <>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => {
                setEditing(null)
                setDraft(null)
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save delivery'}
            </button>
          </>
        }
      >
        {draft && (
          <div className="admin-form-grid">
            <Field label="Courier">
              <input value={draft.courierName} onChange={(event) => setField('courierName', event.target.value)} />
            </Field>
            <Field label="Tracking number">
              <input value={draft.trackingNumber} onChange={(event) => setField('trackingNumber', event.target.value)} />
            </Field>
            <Field label="Tracking URL" hint="Link to the courier's tracking page, if one exists.">
              <input value={draft.trackingUrl} onChange={(event) => setField('trackingUrl', event.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Delivery status">
              <select value={draft.status} onChange={(event) => setField('status', event.target.value as DeliveryStatus | '')}>
                <option value="">No status change</option>
                {DELIVERY_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dispatch date">
              <input type="date" value={draft.dispatchDate} onChange={(event) => setField('dispatchDate', event.target.value)} />
            </Field>
            <Field label="Expected delivery">
              <input type="date" value={draft.expectedDeliveryDate} onChange={(event) => setField('expectedDeliveryDate', event.target.value)} />
            </Field>
            <Field label="Delivery charges (PKR)">
              <input inputMode="decimal" value={draft.deliveryCharges} onChange={(event) => setField('deliveryCharges', event.target.value)} />
            </Field>
            <Field label="Courier notes">
              <input value={draft.notes} onChange={(event) => setField('notes', event.target.value)} />
            </Field>
            <Field label="Status event note" className="is-span-2">
              <input value={draft.eventNote} onChange={(event) => setField('eventNote', event.target.value)} placeholder="Recorded in the delivery event history" />
            </Field>
            {editing && (
              <div className="is-span-2 delivery-recipient">
                <p className="admin-eyebrow">Deliver to</p>
                <p>
                  <strong>{editing.order.customer_name}</strong> · {editing.order.phone}
                </p>
                <p className="admin-muted">
                  {editing.order.address}, {editing.order.city} {editing.order.postal_code}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(historyFor)}
        onClose={() => setHistoryFor(null)}
        title={historyFor ? `Delivery history · Order #${historyFor.order.order_number}` : 'Delivery history'}
      >
        {historyBusy && <Spinner label="Loading events" />}
        {!historyBusy && events && events.length === 0 && <p className="admin-muted">No delivery events recorded yet.</p>}
        {!historyBusy && events && events.length > 0 && (
          <ul className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <span className="timeline__dot" aria-hidden="true" />
                <div>
                  <strong>{titleCase(event.status)}</strong>
                  {event.note && <p>{event.note}</p>}
                  <small>
                    {event.actor_email || 'System'} · {dateTime(event.created_at)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
