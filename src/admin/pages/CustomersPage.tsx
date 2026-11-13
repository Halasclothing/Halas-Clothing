import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { listCustomers } from '../api'
import { dateOnly, money, number } from '../format'
import { useAsync, useDebounced } from '../hooks'
import { EmptyState, ErrorState, KpiCard, PageHeader, Spinner } from '../ui'
import { IconSearch } from '../icons'

type SortKey = 'recent' | 'spend' | 'orders' | 'name'

export function CustomersPage() {
  useDocumentTitle('Customers — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(() => listCustomers(), [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [sort, setSort] = useState<SortKey>('recent')

  const customers = data ?? []
  const visible = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    const filtered = customers.filter(
      (customer) =>
        !term ||
        customer.name.toLowerCase().includes(term) ||
        customer.phone.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term),
    )
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'spend':
          return b.lifetime_spend - a.lifetime_spend
        case 'orders':
          return b.order_count - a.order_count
        case 'name':
          return a.name.localeCompare(b.name)
        case 'recent':
        default:
          return +new Date(b.last_order_at ?? b.created_at) - +new Date(a.last_order_at ?? a.created_at)
      }
    })
  }, [customers, debounced, sort])

  const stats = useMemo(
    () => ({
      total: customers.length,
      repeat: customers.filter((customer) => customer.order_count > 1).length,
      spend: customers.reduce((total, customer) => total + customer.lifetime_spend, 0),
    }),
    [customers],
  )

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Customers"
        description="Profiles are created automatically at checkout. Contact details and internal notes are visible to administrators only."
      />

      <div className="kpi-grid kpi-grid--compact">
        <KpiCard label="Customers" value={number(stats.total)} />
        <KpiCard label="Repeat customers" value={number(stats.repeat)} hint="More than one order" />
        <KpiCard label="Lifetime revenue" value={money(stats.spend)} hint="Excludes cancelled and returned orders" />
        <KpiCard
          label="Average lifetime spend"
          value={money(stats.total ? stats.spend / stats.total : 0)}
        />
      </div>

      <div className="admin-toolbar">
        <div className="admin-toolbar__right">
          <label className="admin-search">
            <IconSearch />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone or email"
              aria-label="Search customers"
            />
          </label>
          <select className="admin-select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort customers">
            <option value="recent">Most recent order</option>
            <option value="spend">Lifetime spend</option>
            <option value="orders">Order count</option>
            <option value="name">Name A–Z</option>
          </select>
          <span className="admin-muted">{number(visible.length)} shown</span>
        </div>
      </div>

      {loading && !data && <Spinner label="Loading customers" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && customers.length === 0 && (
        <EmptyState
          title="No customers yet."
          description="A customer profile is created automatically when the first Cash on Delivery order is placed."
          action={
            <Link className="admin-btn admin-btn--primary" to="/admin/orders">
              View orders
            </Link>
          }
        />
      )}

      {data && customers.length > 0 && (
        <div className="admin-card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th className="is-right">Orders</th>
                  <th className="is-right">Lifetime spend</th>
                  <th>Last order</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <p className="admin-empty-copy">No customers match this search.</p>
                    </td>
                  </tr>
                ) : (
                  visible.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <Link className="admin-link admin-link--strong" to={`/admin/customers/${customer.id}`}>
                          {customer.name}
                        </Link>
                        {customer.notes && <small className="admin-cell-sub">{customer.notes}</small>}
                      </td>
                      <td>
                        {customer.phone}
                        {customer.email && <small className="admin-cell-sub">{customer.email}</small>}
                      </td>
                      <td className="is-right">{number(customer.order_count)}</td>
                      <td className="is-right">{money(customer.lifetime_spend)}</td>
                      <td>{customer.last_order_at ? dateOnly(customer.last_order_at) : '—'}</td>
                      <td>{dateOnly(customer.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
