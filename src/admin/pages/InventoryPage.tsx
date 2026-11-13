import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  adjustInventory,
  getStoreSettings,
  listInventory,
  listMovements,
  type AdminInventoryRow,
  type AdminMovement,
} from '../api'
import { dateTime, number, titleCase } from '../format'
import { useAsync, useDebounced } from '../hooks'
import {
  ErrorState,
  Field,
  KpiCard,
  Modal,
  Notice,
  PageHeader,
  Spinner,
} from '../ui'
import { IconSearch } from '../icons'

type StockFilter = 'all' | 'low' | 'out' | 'healthy'

export function InventoryPage() {
  useDocumentTitle('Inventory — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(async () => {
    const [rows, settings] = await Promise.all([listInventory(), getStoreSettings()])
    return { rows, threshold: settings.low_stock_threshold }
  }, [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [filter, setFilter] = useState<StockFilter>('all')
  const [adjusting, setAdjusting] = useState<AdminInventoryRow | null>(null)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<AdminInventoryRow | null>(null)
  const [history, setHistory] = useState<AdminMovement[] | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)

  const rows = data?.rows ?? []
  const globalThreshold = data?.threshold ?? 3

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const threshold = row.level.low_stock_threshold ?? globalThreshold
        const state = row.level.available_quantity <= 0 ? 'out' : row.level.available_quantity <= threshold ? 'low' : 'healthy'
        return { row, threshold, state: state as 'out' | 'low' | 'healthy' }
      }),
    [rows, globalThreshold],
  )

  const counts = useMemo(
    () => ({
      variants: rows.length,
      out: enriched.filter((item) => item.state === 'out').length,
      low: enriched.filter((item) => item.state === 'low').length,
      onHand: rows.reduce((total, row) => total + row.level.quantity, 0),
      reserved: rows.reduce((total, row) => total + row.level.reserved_quantity, 0),
    }),
    [rows, enriched],
  )

  const visible = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    return enriched.filter(({ row, state }) => {
      if (filter === 'out' && state !== 'out') return false
      if (filter === 'low' && state !== 'low') return false
      if (filter === 'healthy' && state !== 'healthy') return false
      if (!term) return true
      return [row.product.title, row.product.handle, row.product.category, row.variant.sku ?? '', row.variant.size, row.variant.colour]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [enriched, filter, debounced])

  const openAdjust = (row: AdminInventoryRow) => {
    setAdjusting(row)
    setDelta('')
    setReason('')
    setProblem(null)
  }

  const applyAdjust = async () => {
    if (!adjusting) return
    const amount = Number(delta)
    if (!Number.isFinite(amount) || amount === 0) {
      setProblem('Enter a non-zero adjustment, for example 5 or -2.')
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const after = await adjustInventory(adjusting.variant.id as string, Math.floor(amount), reason)
      setNotice(
        `${adjusting.product.title}${adjusting.variant.size ? ` · ${adjusting.variant.size}` : ''} is now ${after} on hand.`,
      )
      setAdjusting(null)
      reload()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The stock could not be adjusted.')
    } finally {
      setBusy(false)
    }
  }

  const openHistory = async (row: AdminInventoryRow) => {
    setHistoryFor(row)
    setHistory(null)
    setHistoryBusy(true)
    try {
      setHistory(await listMovements(row.variant.id as string, 30))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The history could not be loaded.')
    } finally {
      setHistoryBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Inventory"
        description="Stock is tracked per variant. Every sale, confirmation, cancellation and manual edit is recorded in the movement history."
      />

      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      {loading && !data && <Spinner label="Loading inventory" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="kpi-grid kpi-grid--compact">
            <KpiCard label="Active variants" value={number(counts.variants)} />
            <KpiCard label="Units on hand" value={number(counts.onHand)} />
            <KpiCard label="Reserved for orders" value={number(counts.reserved)} hint="Held for open orders, not sellable" />
            <KpiCard label="Low stock" value={number(counts.low)} tone={counts.low ? 'warning' : 'success'} />
            <KpiCard label="Out of stock" value={number(counts.out)} tone={counts.out ? 'danger' : 'success'} />
          </div>

          <div className="admin-toolbar">
            <div className="admin-tabs">
              {(['all', 'low', 'out', 'healthy'] as StockFilter[]).map((value) => (
                <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>
                  {titleCase(value)}
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
                  placeholder="Search product, SKU or variant"
                  aria-label="Search inventory"
                />
              </label>
            </div>
          </div>

          <div className="admin-card admin-table-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>SKU</th>
                    <th className="is-right">On hand</th>
                    <th className="is-right">Reserved</th>
                    <th className="is-right">Available</th>
                    <th className="is-right">Threshold</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <p className="admin-empty-copy">No variants match this view.</p>
                      </td>
                    </tr>
                  ) : (
                    visible.map(({ row, threshold, state }) => (
                      <tr key={row.variant.id}>
                        <td>
                          <div className="admin-product-cell admin-product-cell--compact">
                            {row.product.image_url ? <img src={row.product.image_url} alt="" loading="lazy" /> : <span className="admin-thumb-fallback" />}
                            <div>
                              <Link className="admin-link admin-link--strong" to={`/admin/products/${row.product.id}`}>
                                {row.product.title}
                              </Link>
                              <small className="admin-cell-sub">{row.product.status === 'published' ? 'Published' : titleCase(row.product.status)}</small>
                            </div>
                          </div>
                        </td>
                        <td>{[row.variant.size, row.variant.colour].filter(Boolean).join(' · ') || '—'}</td>
                        <td>{row.variant.sku || '—'}</td>
                        <td className="is-right">{number(row.level.quantity)}</td>
                        <td className="is-right">{number(row.level.reserved_quantity)}</td>
                        <td className="is-right">
                          <span className={state === 'out' ? 'stock stock--out' : state === 'low' ? 'stock stock--low' : 'stock'}>
                            {number(row.level.available_quantity)}
                          </span>
                        </td>
                        <td className="is-right">{number(threshold)}</td>
                        <td>
                          <span className={`badge badge--${state === 'out' ? 'danger' : state === 'low' ? 'warning' : 'success'}`}>
                            {state === 'out' ? 'Out of stock' : state === 'low' ? 'Low stock' : 'Healthy'}
                          </span>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => openAdjust(row)}>
                              Adjust
                            </button>
                            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => void openHistory(row)}>
                              History
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

          <p className="admin-muted">
            The storefront only shows a size as available when its variant has stock beyond reservations. Edit stock in
            the product editor for a full set of sizes; use Adjust for day-to-day corrections.
          </p>
        </>
      )}

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Adjust stock"
        description={
          adjusting
            ? `${adjusting.product.title} · ${[adjusting.variant.size, adjusting.variant.colour].filter(Boolean).join(' / ') || 'Default'}`
            : undefined
        }
        footer={
          <>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setAdjusting(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => void applyAdjust()} disabled={busy}>
              {busy ? 'Saving…' : 'Apply adjustment'}
            </button>
          </>
        }
      >
        {adjusting && (
          <>
            <dl className="admin-summary-list admin-summary-list--inline">
              <div>
                <dt>On hand</dt>
                <dd>{adjusting.level.quantity}</dd>
              </div>
              <div>
                <dt>Reserved</dt>
                <dd>{adjusting.level.reserved_quantity}</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{adjusting.level.available_quantity}</dd>
              </div>
            </dl>
            <Field label="Adjustment" hint="Use a negative number to reduce stock. The result cannot fall below reserved units.">
              <input inputMode="numeric" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="e.g. 5 or -2" />
            </Field>
            <Field label="Reason">
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Stocktake correction, return to stock, damage…" />
            </Field>
            {problem && <Notice tone="error">{problem}</Notice>}
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(historyFor)}
        onClose={() => setHistoryFor(null)}
        title="Stock movement history"
        description={
          historyFor
            ? `${historyFor.product.title} · ${[historyFor.variant.size, historyFor.variant.colour].filter(Boolean).join(' / ') || 'Default'}`
            : undefined
        }
        wide
      >
        {historyBusy && <Spinner label="Loading movements" />}
        {!historyBusy && history && history.length === 0 && <p className="admin-muted">No stock movements recorded for this variant yet.</p>}
        {!historyBusy && history && history.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th className="is-right">Change</th>
                  <th className="is-right">On hand after</th>
                  <th className="is-right">Reserved after</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((movement) => (
                  <tr key={movement.id}>
                    <td>{dateTime(movement.created_at)}</td>
                    <td>{titleCase(movement.type)}</td>
                    <td className={`is-right ${movement.quantity_change < 0 ? 'is-negative' : movement.quantity_change > 0 ? 'is-positive' : ''}`}>
                      {movement.quantity_change > 0 ? '+' : ''}
                      {movement.quantity_change}
                      {movement.reserved_change ? ` / ${movement.reserved_change > 0 ? '+' : ''}${movement.reserved_change} reserved` : ''}
                    </td>
                    <td className="is-right">{movement.quantity_after}</td>
                    <td className="is-right">{movement.reserved_after}</td>
                    <td>{movement.reason || '—'}</td>
                    <td>{movement.actor_email || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}
