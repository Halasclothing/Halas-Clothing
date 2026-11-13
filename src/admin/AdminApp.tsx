import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { AdminLayout } from './AdminLayout'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CollectionEditorPage } from './pages/CollectionEditorPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeliveriesPage } from './pages/DeliveriesPage'
import { InventoryPage } from './pages/InventoryPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductEditorPage } from './pages/ProductEditorPage'
import { ProductsPage } from './pages/ProductsPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'

function BootScreen() {
  return (
    <div className="admin-boot" role="status" aria-live="polite">
      <span className="admin-boot__mark">HALA.S</span>
      <span className="admin-spinner" aria-hidden="true" />
      <p>Verifying administrator session…</p>
    </div>
  )
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <BootScreen />
  if (auth.status === 'unconfigured') return <SetupPage />
  if (auth.status !== 'authorized') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductEditorPage />} />
          <Route path="products/:id" element={<ProductEditorPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/new" element={<CollectionEditorPage />} />
          <Route path="collections/:id" element={<CollectionEditorPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
