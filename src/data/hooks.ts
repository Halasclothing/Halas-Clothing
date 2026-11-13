import { useEffect, useState } from 'react'
import { catalogApi } from './api'
import type { SortKey } from './api'
import type { CollectionHandle, Product } from './types'

interface CollectionState {
  products: Product[]
  meta: Awaited<ReturnType<typeof catalogApi.getCollection>> extends infer R
    ? R extends { meta: infer M }
      ? M
      : null
    : null
  loading: boolean
  error: string | null
}

/**
 * Fetches a collection once (stable deps) so sorting stays a client-side
 * operation and the provider is never re-hit while a shopper uses controls.
 */
export function useCollection(handle: CollectionHandle) {
  const [state, setState] = useState<CollectionState>({
    products: [],
    meta: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    catalogApi
      .getCollection(handle)
      .then((res) => {
        if (!alive) return
        if (!res) {
          setState({ products: [], meta: null, loading: false, error: 'unknown-collection' })
          return
        }
        setState({ products: res.products, meta: res.meta, loading: false, error: null })
      })
      .catch(() => alive && setState({ products: [], meta: null, loading: false, error: 'catalog-unavailable' }))
    return () => {
      alive = false
    }
  }, [handle])

  return state
}

export const applySort = (products: Product[], key: SortKey): Product[] => {
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

export function useProduct(handle: string | undefined) {
  const [state, setState] = useState<{ product: Product | null; loading: boolean; error: string | null }>({
    product: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!handle) {
      setState({ product: null, loading: false, error: 'not-found' })
      return
    }
    let alive = true
    setState({ product: null, loading: true, error: null })
    catalogApi
      .getProduct(handle)
      .then((product) => {
        if (!alive) return
        setState({ product, loading: false, error: product ? null : 'not-found' })
      })
      .catch(() => alive && setState({ product: null, loading: false, error: 'catalog-unavailable' }))
    return () => {
      alive = false
    }
  }, [handle])

  return state
}
