import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { getAnalytics } from '../api'
import { dateOnly, daysAgo, isoDay, money, number } from '../format'
import { useAsync } from '../hooks'
import { IconAlert, IconOrders, IconRefresh, IconTrendUp } from '../icons'
import {
  BreakdownBars,
  Card,
  ErrorState,
  KpiCard,
  PageHeader,
  RevenueChart,
  Spinner,
  StatusBadge,
} from '../ui'

const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
]

const startOfDay = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime()) ? daysAgo(30) : date
}

const endOfDay = (iso: string) => {
  const date = new Date(`${iso}T23:59:59`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export function AnalyticsPage() {
  useDocumentTitle('Analytics — HALA.S Admin')
  const [from, setFrom] = useState(isoDay(daysAgo(30)))
  const [to, setTo] = useState(isoDay(new Date()))

  const { data, loading, error, reload } = useAsync(
    () => getAnalytics(startOfDay(from), endOfDay(to)),
    [from, to],
  )

  const preset = useMemo(() => {
    const match = PRESETS.find((option) => isoDay(daysAgo(option.days)) === from && isoDay(new Date()) === to)
    return match?.days ?? null
  }, [from, to])

  const applyPreset = (days: number) => {
    setFrom(isoDay(daysAgo(days)))
    setTo(isoDay(new Date()))
  }

  const invalidRange = from > to
  const totalUnits = data ? number(data.units) : '0'

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Performance"
        description="Revenue, order flow and stock pressure over any date range. Figures are calculated by the database from real orders only."
        actions={
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={reload}>
            <IconRefresh /> Refresh
          </button>
        }
      />

      <div className="admin-toolbar admin-toolbar--wrap">
        <div className="admin-toolbar__right">
          <div className="admin-preset-row" role="group" aria-label="Date range presets">
            {PRESETS.map((option) => (
              <button
                key={option.days}
                type="button"
                className={`admin-chip ${preset === option.days ? 'is-active' : ''}`.trim()}
                onClick={() => applyPreset(option.days)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="admin-inline-field">
            <span>From</span>
            <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="admin-inline-field">
            <span>To</span>
            <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>

      {invalidRange && <p className="admin-field__error">The start date must be before the end date.</p>}
      {loading && !data && <Spinner label="Calculating performance" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && !invalidRange && (
        <>
          <p className="admin-muted admin-range-note">
            Showing {dateOnly(data.range.from)} – {dateOnly(data.range.to)} ({data.range.timezone})
          </p>

          <div className="kpi-grid">
            <KpiCard
              label="Revenue"
              value={money(data.revenue)}
              hint={`${number(data.sales_orders)} selling orders · ${totalUnits} units`}
              icon={<IconTrendUp />}
              tone="accent"
            />
            <KpiCard
              label="Orders"
              value={number(data.orders)}
              hint={`${number(data.pending)} new · ${number(data.awaiting_dispatch)} awaiting dispatch`}
              icon={<IconOrders />}
            />
            <KpiCard label="Average order" value={money(data.average_order)} hint="Valid orders only" />
            <KpiCard
              label="Not delivered"
              value={number(data.cancelled + data.returned)}
              hint={`${number(data.cancelled)} cancelled · ${number(data.returned)} returned`}
              icon={<IconAlert />}
              tone={data.cancelled + data.returned > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="kpi-grid kpi-grid--compact">
            <KpiCard label="Today" value={number(data.today_orders)} hint="Orders placed" />
            <KpiCard label="This week" value={money(data.week_sales)} hint={`${number(data.week_orders)} orders`} />
            <KpiCard label="This month" value={money(data.month_sales)} hint={`${number(data.month_orders)} orders`} />
            <KpiCard label="Out for delivery" value={number(data.out_for_delivery)} tone="accent" />
            <KpiCard label="Delivered" value={number(data.delivered)} tone="success" />
            <KpiCard
              label="Low stock"
              value={number(data.low_stock_count)}
              hint="At or below threshold"
              tone={data.low_stock_count ? 'warning' : 'success'}
            />
          </div>

          <div className="admin-grid admin-grid--2">
            <Card title="Revenue by day" description="Cancelled, returned and failed-payment orders excluded.">
              <RevenueChart series={data.series} />
            </Card>
            <Card title="Order status mix" description="Every order placed in the selected range.">
              <BreakdownBars values={data.status_breakdown} />
            </Card>
          </div>

          <div className="admin-grid admin-grid--2">
            <Card
              title="Best sellers"
              description="Ranked by units sold in this range."
              actions={
                <Link className="admin-link" to="/admin/products">
                  Products
                </Link>
              }
              flush
            >
              {data.best_sellers.length === 0 ? (
                <p className="admin-empty-copy">No sales recorded in this range.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th className="is-narrow">#</th>
                        <th>Product</th>
                        <th className="is-right">Units</th>
                        <th className="is-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.best_sellers.map((item, index) => (
                        <tr key={item.product_id}>
                          <td className="is-narrow">{String(index + 1).padStart(2, '0')}</td>
                          <td>{item.title}</td>
                          <td className="is-right">{number(item.units)}</td>
                          <td className="is-right">{money(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card
              title="Low stock"
              description="Published variants at or below their threshold."
              actions={
                <Link className="admin-link" to="/admin/inventory">
                  Inventory
                </Link>
              }
              flush
            >
              {data.low_stock.length === 0 ? (
                <p className="admin-empty-copy">Every published variant is above its threshold.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Variant</th>
                        <th className="is-right">Reserved</th>
                        <th className="is-right">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.low_stock.map((item) => (
                        <tr key={item.variant_id}>
                          <td>{item.title}</td>
                          <td>{item.variant ?? '—'}</td>
                          <td className="is-right">{number(item.reserved)}</td>
                          <td className="is-right">
                            <span className={item.available <= 0 ? 'stock stock--out' : 'stock stock--low'}>
                              {number(item.available)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="Order snapshot" description="The newest orders in this range." flush>
            {data.recent_orders.length === 0 ? (
              <p className="admin-empty-copy">No orders in this range.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th className="is-right">Items</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th className="is-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link className="admin-link admin-link--strong" to={`/admin/orders/${order.id}`}>
                            #{order.order_number}
                          </Link>
                        </td>
                        <td>
                          {order.customer_name}
                          <small className="admin-cell-sub">{order.city}</small>
                        </td>
                        <td className="is-right">{number(order.item_count)}</td>
                        <td>
                          <StatusBadge value={order.order_status} />
                        </td>
                        <td>
                          <StatusBadge value={order.payment_status} />
                        </td>
                        <td className="is-right">{money(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
