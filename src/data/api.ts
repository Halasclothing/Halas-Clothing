import type { CollectionHandle, CollectionMeta, Product } from './types'
import { COLLECTIONS, PRODUCTS, isNewIn, isOnSale } from './catalog'
import { fetchLiveCatalogue, fetchLiveCollection, fetchLiveProduct } from './live'
import { backendReady } from '../lib/supabase'

/**
 * Storefront data provider. When Supabase is configured every call reads the
 * live catalogue (published rows only, enforced by RLS); otherwise the bundled
 * catalogue keeps local design work usable.
 */

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
]

export async function getCatalogueProducts(): Promise<Product[]> {
  const live = await fetchLiveCatalogue()
  if (backendReady && !live) throw new Error('The live HALA.S catalogue is temporarily unavailable.')
  return live?.products ?? PRODUCTS
}

export async function getCatalogueCollections(): Promise<CollectionMeta[]> {
  const live = await fetchLiveCatalogue()
  if (backendReady && !live) throw new Error('The live HALA.S collections are temporarily unavailable.')
  return live?.collections ?? COLLECTIONS
}

export const filterProducts = (
  handle: CollectionHandle,
  products: Product[] = PRODUCTS,
): Product[] => {
  switch (handle) {
    case 'all':
      return products
    case 'new-in':
      return products.filter((p) => isNewIn(p))
    case 'sale':
      return products.filter(isOnSale)
    default:
      return products.filter((p) => p.collections.includes(handle))
  }
}

export const sortProducts = (products: Product[], key: SortKey): Product[] => {
  const list = [...products]
  switch (key) {
    case 'newest':
      return list.sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
    case 'price-asc':
      return list.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return list.sort((a, b) => b.price - a.price)
    case 'featured':
    default:
      return list
  }
}

export const catalogApi = {
  async listCollections(): Promise<CollectionMeta[]> {
    return getCatalogueCollections()
  },

  async getCollection(
    handle: CollectionHandle,
    sort: SortKey = 'featured',
  ): Promise<{ meta: CollectionMeta; products: Product[] } | null> {
    const live = await fetchLiveCollection(handle)
    if (live) return { meta: live.meta, products: sortProducts(live.products, sort) }

    const remote = await fetchLiveCatalogue()
    if (remote) return null
    if (backendReady) throw new Error('The live HALA.S catalogue is temporarily unavailable.')

    const meta = COLLECTIONS.find((collection) => collection.handle === handle)
    if (!meta) return null
    const catalogue = await getCatalogueProducts()
    return { meta, products: sortProducts(filterProducts(handle, catalogue), sort) }
  },

  async getProduct(handle: string): Promise<Product | null> {
    if (backendReady) return fetchLiveProduct(handle)
    const catalogue = await getCatalogueProducts()
    return catalogue.find((product) => product.handle === handle) ?? null
  },

  async search(query: string, limit = 6): Promise<Product[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const catalogue = await getCatalogueProducts()
    return catalogue
      .filter((product) =>
        [
          product.title,
          product.colourName,
          product.fabric,
          product.category,
          product.vendor,
          product.description,
          ...(product.tags ?? []),
          ...product.collections,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, limit)
  },

  async related(product: Product, limit = 4): Promise<Product[]> {
    const catalogue = await getCatalogueProducts()
    const shared = (candidate: Product) =>
      candidate.collections.filter((collection) => product.collections.includes(collection)).length
    return catalogue
      .filter((candidate) => candidate.id !== product.id)
      .sort((a, b) => shared(b) - shared(a))
      .slice(0, limit)
  },

  /** Facets derived from the products actually shown, never hard-coded. */
  facets(products: Product[]) {
    const sizes = new Map<string, number>()
    const colours = new Map<string, { hex: string; count: number }>()
    let inStock = 0
    for (const p of products) {
      if (p.sizes.some((s) => s.available)) inStock += 1
      for (const s of p.sizes) if (s.available) sizes.set(s.label, (sizes.get(s.label) ?? 0) + 1)
      const c = colours.get(p.colourName)
      if (c) c.count += 1
      else colours.set(p.colourName, { hex: p.colourHex, count: 1 })
    }
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL']
    return {
      sizes: [...sizes.keys()].sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)),
      colours: [...colours.entries()].map(([name, v]) => ({ name, ...v })),
      inStock,
    }
  },
}
