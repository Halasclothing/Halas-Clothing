import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { CartDrawer } from './components/CartDrawer'
import { MobileMenu } from './components/MobileMenu'
import { SearchOverlay } from './components/SearchOverlay'
import { UiProvider, useUi } from './state/ui'
import { CartProvider } from './state/cart'
import { RecentlyViewedProvider, WishlistProvider } from './state/wishlist'
import { Home } from './pages/Home'
import { CollectionPage } from './pages/CollectionPage'
import { ProductPage } from './pages/ProductPage'
import { LookbookPage } from './pages/LookbookPage'
import { WishlistPage } from './pages/WishlistPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { BlogPage } from './pages/BlogPage'
import { InfoPage } from './pages/InfoPage'
import { ScrollFramesBackground } from './components/ScrollFramesBackground'
import { SupportWidgets } from './components/SupportWidgets'
import { AdminApp } from './admin/AdminApp'
import { CheckoutPage } from './pages/CheckoutPage'
import { CartPage } from './pages/CartPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function LiveRegion() {
  const { announcement } = useUi()
  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {announcement}
    </p>
  )
}

export default function App() {
  const { pathname } = useLocation()

  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <AdminApp />

  return (
    <UiProvider>
      <CartProvider>
        <WishlistProvider>
          <RecentlyViewedProvider>
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <ScrollToTop />
            {pathname === '/' && <ScrollFramesBackground />}
            <Header />
            <main id="main" className="page" tabIndex={-1}>
              <Routes>
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/" element={<Home />} />
                <Route path="/collections" element={<Navigate to="/collections/all" replace />} />
                <Route path="/collections/:handle" element={<CollectionPage />} />
                <Route path="/product/:handle" element={<ProductPage />} />
                <Route path="/lookbook" element={<LookbookPage />} />
                <Route path="/journal" element={<BlogPage />} />
                <Route path="/journal/:slug" element={<BlogPage />} />
                <Route path="/about" element={<InfoPage />} />
                <Route path="/contact" element={<InfoPage />} />
                <Route path="/size-guide" element={<InfoPage />} />
                <Route path="/faq" element={<InfoPage />} />
                <Route path="/shipping" element={<InfoPage />} />
                <Route path="/privacy" element={<InfoPage />} />
                <Route path="/terms" element={<InfoPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
            <CartDrawer />
            <SearchOverlay />
            <MobileMenu />
            <LiveRegion />
            <SupportWidgets />
          </RecentlyViewedProvider>
        </WishlistProvider>
      </CartProvider>
    </UiProvider>
  )
}
