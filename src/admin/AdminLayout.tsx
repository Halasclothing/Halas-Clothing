import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import {
  IconAnalytics,
  IconClose,
  IconCollections,
  IconCustomers,
  IconDashboard,
  IconDeliveries,
  IconExternal,
  IconInventory,
  IconLogout,
  IconMenu,
  IconNotifications,
  IconOrders,
  IconProducts,
  IconSettings,
} from './icons'

const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: IconDashboard, end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: IconAnalytics },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/admin/products', label: 'Products', icon: IconProducts },
      { to: '/admin/collections', label: 'Collections', icon: IconCollections },
      { to: '/admin/inventory', label: 'Inventory', icon: IconInventory },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: IconOrders },
      { to: '/admin/deliveries', label: 'Deliveries', icon: IconDeliveries },
      { to: '/admin/customers', label: 'Customers', icon: IconCustomers },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/admin/notifications', label: 'Notifications', icon: IconNotifications },
      { to: '/admin/settings', label: 'Settings', icon: IconSettings },
    ],
  },
]

export function AdminLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className={`admin-shell ${menuOpen ? 'is-menu-open' : ''}`.trim()}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar__head">
          <Link to="/admin" className="admin-brand">
            <span className="admin-brand__mark">H</span>
            <span>
              <strong>HALA.S</strong>
              <small>Admin studio</small>
            </span>
          </Link>
          <button
            type="button"
            className="admin-icon-btn admin-sidebar__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose />
          </button>
        </div>

        <nav className="admin-nav">
          {NAV.map((group) => (
            <div className="admin-nav__group" key={group.label}>
              <p className="admin-nav__label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) => `admin-nav__link ${isActive ? 'is-active' : ''}`.trim()}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__foot">
          <Link to="/" className="admin-nav__link" target="_blank" rel="noreferrer">
            <IconExternal />
            <span>View storefront</span>
          </Link>
          <div className="admin-user">
            <span className="admin-avatar" aria-hidden="true">
              {(auth.user?.email ?? 'A').slice(0, 1).toUpperCase()}
            </span>
            <span className="admin-user__meta">
              <strong>{auth.user?.email ?? 'Administrator'}</strong>
              <small>Administrator</small>
            </span>
            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => void auth.signOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className="admin-scrim"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-icon-btn admin-topbar__menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <IconMenu />
          </button>
          <div className="admin-topbar__crumbs">
            <span>HALA.S</span>
            <span aria-hidden="true">/</span>
            <strong>Commerce admin</strong>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/" target="_blank" rel="noreferrer" className="admin-btn admin-btn--ghost admin-btn--small">
              Storefront <IconExternal />
            </Link>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => void auth.signOut()}>
              <IconLogout /> Sign out
            </button>
          </div>
        </header>

        <div className="admin-page">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
