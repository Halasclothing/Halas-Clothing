import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { getAnalytics } from '../api'
import { dateTime, daysAgo, money, number, titleCase } from '../format'
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

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

export function DashboardPage() {
  useDocumentTitle('Dashboard — HALA.S Admin')
  const [range, setRange] = useState(30)
  const { data, loading, error, reload } = useAsync(
    () => getAnalytics(daysAgo(range), new Date()),
    [range],
  )

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A live reading of the store: revenue, orders, stock pressure and what needs attention next."
        actions={
          <>
            <label className="admin-inline-field">
              <span>Period</span>
              <select value={range} onChange={(event) => setRange(Number(event.target.value))}>
                {RANGES.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={reload}>
              <IconRefresh /> Refresh
            </button>
            <Link className="admin-btn admin-btn--primary admin-btn--small" to="/admin/products/new">
              Add product
            </Link>
          </>
        }
      />

      {loading && !data && <Spinner label="Reading the store" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Revenue"
              value={money(data.revenue)}
              hint={`${number(data.sales_orders)} selling orders · ${number(data.units)} units`}
              icon={<IconTrendUp />}
              tone="accent"
            />
            <KpiCard label="Orders" value={number(data.orders)} hint={`${number(data.today_orders)} placed today`} icon={<IconOrders />} />
            <KpiCard label="Average order" value={money(data.average_order)} hint="Across valid orders in this period" />
            <KpiCard
              label="Needs action"
              value={number(data.pending + data.awaiting_dispatch)}
              hint={`${number(data.pending)} new · ${number(data.awaiting_dispatch)} awaiting dispatch`}
              icon={<IconAlert />}
              tone={data.pending + data.awaiting_dispatch > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="kpi-grid kpi-grid--compact">
            <KpiCard label="Out for delivery" value={number(data.out_for_delivery)} tone="accent" />
            <KpiCard label="Delivered" value={number(data.delivered)} tone="success" />
            <KpiCard label="Cancelled" value={number(data.cancelled)} tone={data.cancelled ? 'danger' : 'neutral'} />
            <KpiCard label="Returned" value={number(data.returned)} tone={data.returned ? 'danger' : 'neutral'} />
            <KpiCard
              label="Low stock"
              value={number(data.low_stock_count)}
              hint="Published variants at or below threshold"
              tone={data.low_stock_count ? 'warning' : 'success'}
            />
            <KpiCard label="This month" value={money(data.month_sales)} hint={`${number(data.month_orders)} orders`} />
          </div>

          <div className="admin-grid admin-grid--2">
            <Card title="Revenue by day" description="Cancelled, returned and failed-payment orders excluded.">
              <RevenueChart series={data.series} />
            </Card>
            <Card title="Order status" description="Every order placed in the selected period.">
              <BreakdownBars values={data.status_breakdown} />
            </Card>
          </div>

          <div className="admin-grid admin-grid--2">
            <Card
              title="Recent orders"
              description="Newest orders across the store."
              actions={
                <Link className="admin-link" to="/admin/orders">
                  All orders
                </Link>
              }
              flush
            >
              {data.recent_orders.length === 0 ? (
                <p className="admin-empty-copy">No orders yet. New Cash on Delivery orders appear here immediately.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Status</th>
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
                            <small className="admin-cell-sub">{dateTime(order.placed_at)}</small>
                          </td>
                          <td>
                            {order.customer_name}
                            <small className="admin-cell-sub">{order.city}</small>
                          </td>
                          <td>
                            <StatusBadge value={order.order_status} />
                          </td>
                          <td className="is-right">{money(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card
              title="Low stock"
              description="Variants at or below their low-stock threshold."
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
                        <th className="is-right">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.low_stock.slice(0, 8).map((item) => (
                        <tr key={item.variant_id}>
                          <td>{item.title}</td>
                          <td>{item.variant ?? '—'}</td>
                          <td className="is-right">
                            <span className={item.available <= 0 ? 'stock stock--out' : 'stock stock--low'}>
                              {item.available}
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

          <div className="admin-grid admin-grid--2">
            <Card title="Best sellers" description="By units sold in the selected period.">
              {data.best_sellers.length === 0 ? (
                <p className="admin-muted">No sales in this period yet.</p>
              ) : (
                <ol className="admin-ranked">
                  {data.best_sellers.map((item, index) => (
                    <li key={item.product_id}>
                      <span className="admin-ranked__index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="admin-ranked__title">{item.title}</span>
                      <span>{number(item.units)} units</span>
                      <strong>{money(item.revenue)}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card title="Recent activity" description="Audited administrator and system actions.">
              {data.activity.length === 0 ? (
                <p className="admin-muted">No activity recorded yet.</p>
              ) : (
                <ul className="admin-activity">
                  {data.activity.slice(0, 8).map((entry) => (
                    <li key={entry.id}>
                      <span className="admin-activity__dot" aria-hidden="true" />
                      <div>
                        <strong>{titleCase(entry.action.replace(/\./g, ' '))}</strong>
                        <small>
                          {entry.entity_type || 'system'}
                          {entry.actor_email ? ` · ${entry.actor_email}` : ''} · {dateTime(entry.created_at)}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
