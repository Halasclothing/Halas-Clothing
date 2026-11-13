import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PRODUCTS } from '../data/catalog'
import { getCatalogueProducts } from '../data/api'
import type { Product } from '../data/types'
import { storage } from './storage'

const KEY = 'halas.cart.v1'

export interface CartLine {
  key: string
  handle: string
  size: string
  colour: string
  variantId?: string
  quantity: number
}

export interface ResolvedLine extends CartLine {
  product: Product
  unitPrice: number
  lineTotal: number
}

interface CartApi {
  lines: ResolvedLine[]
  count: number
  subtotal: number
  add: (
    product: Product,
    size: string,
    quantity?: number,
    options?: { colour?: string; variantId?: string },
  ) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartApi | null>(null)

const lineKey = (handle: string, size: string, colour: string) =>
  `${handle}::${size}::${colour}`
const MAX_QTY = 12

export function CartProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<CartLine[]>(() => storage.read<CartLine[]>(KEY, []))
  const [catalogue, setCatalogue] = useState<Product[]>(PRODUCTS)

  useEffect(() => {
    let active = true
    const refresh = () => {
      getCatalogueProducts()
        .then((items) => { if (active) setCatalogue(items) })
        .catch(() => undefined)
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
    }
  }, [])

  useEffect(() => {
    storage.write(KEY, raw)
  }, [raw])

  // Lines are re-resolved against the catalogue on every render so a price or
  // an availability change is reflected immediately, never cached stale.
  const lines = useMemo<ResolvedLine[]>(
    () =>
      raw
        .map((line) => {
          const product = catalogue.find((p) => p.handle === line.handle)
          if (!product) return null
          const variant = product.variants?.find(
            (candidate) =>
              (line.variantId && candidate.id === line.variantId) ||
              (!line.variantId &&
                candidate.size === line.size &&
                (!line.colour || candidate.colour === line.colour)),
          )
          const unitPrice = variant?.price ?? product.price
          return {
            ...line,
            colour: line.colour ?? '',
            product,
            unitPrice,
            lineTotal: unitPrice * line.quantity,
          }
        })
        .filter((line): line is ResolvedLine => line !== null),
    [raw, catalogue],
  )

  const add = useCallback<CartApi['add']>((product, size, quantity = 1, options = {}) => {
    const variant =
      (options.variantId && product.variants?.find((item) => item.id === options.variantId)) ||
      product.variants?.find(
        (item) => item.size === size && (!options.colour || item.colour === options.colour),
      )
    const colour = options.colour ?? variant?.colour ?? ''
    setRaw((prev) => {
      const key = lineKey(product.handle, size, colour)
      const existing = prev.find((line) => line.key === key)
      if (existing) {
        return prev.map((line) =>
          line.key === key
            ? {
                ...line,
                variantId: variant?.id ?? line.variantId,
                quantity: Math.min(MAX_QTY, line.quantity + quantity),
              }
            : line,
        )
      }
      return [
        ...prev,
        {
          key,
          handle: product.handle,
          size,
          colour,
          variantId: variant?.id,
          quantity: Math.min(MAX_QTY, quantity),
        },
      ]
    })
  }, [])

  const setQuantity = useCallback<CartApi['setQuantity']>((key, quantity) => {
    setRaw((prev) =>
      quantity < 1
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    )
  }, [])

  const remove = useCallback<CartApi['remove']>((key) => {
    setRaw((prev) => prev.filter((l) => l.key !== key))
  }, [])

  const value = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.lineTotal, 0),
      add,
      setQuantity,
      remove,
      clear: () => setRaw([]),
    }),
    [lines, add, setQuantity, remove],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = (): CartApi => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
