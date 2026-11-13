import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PRODUCTS } from '../data/catalog'
import { getCatalogueProducts } from '../data/api'
import type { Product } from '../data/types'
import { storage } from './storage'

const WISHLIST_KEY = 'halas.wishlist.v1'
const RECENT_KEY = 'halas.recent.v1'

interface WishlistApi {
  handles: string[]
  products: Product[]
  count: number
  has: (handle: string) => boolean
  toggle: (handle: string) => boolean
}

const WishlistContext = createContext<WishlistApi | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [handles, setHandles] = useState<string[]>(() => storage.read<string[]>(WISHLIST_KEY, []))
  const [catalogue, setCatalogue] = useState<Product[]>(PRODUCTS)
  useEffect(() => { let active = true; getCatalogueProducts().then(items => { if(active) setCatalogue(items) }).catch(() => undefined); return () => { active = false } }, [])

  useEffect(() => {
    storage.write(WISHLIST_KEY, handles)
  }, [handles])

  const toggle = useCallback((handle: string) => {
    let added = false
    setHandles((prev) => {
      added = !prev.includes(handle)
      return added ? [...prev, handle] : prev.filter((h) => h !== handle)
    })
    return added
  }, [])

  // Resolve at render time: a removed or renamed catalogue item simply stops
  // appearing, instead of showing a dead card.
  const products = useMemo(
    () => handles.map((h) => catalogue.find((p) => p.handle === h)).filter((p): p is Product => !!p),
    [handles, catalogue],
  )

  const value = useMemo<WishlistApi>(
    () => ({ handles, products, count: products.length, has: (h) => handles.includes(h), toggle }),
    [handles, products, toggle],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export const useWishlist = (): WishlistApi => {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}

interface RecentApi {
  handles: string[]
  products: Product[]
  push: (handle: string) => void
}

const RecentContext = createContext<RecentApi | null>(null)

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [handles, setHandles] = useState<string[]>(() => storage.read<string[]>(RECENT_KEY, []))
  const [catalogue, setCatalogue] = useState<Product[]>(PRODUCTS)
  useEffect(() => { let active = true; getCatalogueProducts().then(items => { if(active) setCatalogue(items) }).catch(() => undefined); return () => { active = false } }, [])

  useEffect(() => {
    storage.write(RECENT_KEY, handles)
  }, [handles])

  const push = useCallback((handle: string) => {
    setHandles((prev) => [handle, ...prev.filter((h) => h !== handle)].slice(0, 8))
  }, [])

  const products = useMemo(
    () => handles.map((h) => catalogue.find((p) => p.handle === h)).filter((p): p is Product => !!p),
    [handles, catalogue],
  )

  const value = useMemo<RecentApi>(() => ({ handles, products, push }), [handles, products, push])

  return <RecentContext.Provider value={value}>{children}</RecentContext.Provider>
}

export const useRecentlyViewed = (): RecentApi => {
  const ctx = useContext(RecentContext)
  if (!ctx) throw new Error('useRecentlyViewed must be used inside RecentlyViewedProvider')
  return ctx
}
