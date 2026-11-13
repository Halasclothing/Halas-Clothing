import type { Product, ImageRef } from './types'

const env = (import.meta as any).env || {}
export const SUPABASE_URL = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '')
export const backendReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const headers = (token?: string) => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' })

export function productFromRow(row: any): Product {
  const imgs: ImageRef[] = (row.images || []).map((im: any) => typeof im === 'string' ? ({ src: im, small: im, width: 900, height: 1200, alt: row.title, kind: 'catalog' as const }) : im)
  const inStock = Number(row.stock ?? 0) > 0
  const sizes = (row.sizes || []).map((s: any) => {
    const option = typeof s === 'string' ? { label: s, available: true } : s
    return { ...option, available: Boolean(option.available ?? true) && inStock }
  })
  return { id: row.id, handle: row.handle, title: row.title, colourName: row.colour_name || 'Multi', colourHex: row.colour_hex || '#c8b9a5', price: Number(row.price || 0), compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : undefined, currency: 'PKR', fabric: row.fabric || '', care: row.care || '', description: row.description || '', images: imgs, sizes, collections: (row.collections || []) as Product['collections'], releasedAt: row.released_at || row.created_at || new Date().toISOString() }
}
export async function listLiveProducts(): Promise<Product[] | null> {
  if (!backendReady) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&status=eq.published&order=created_at.desc`, { headers: headers() })
  if (!res.ok) throw new Error(`Catalogue service error (${res.status})`)
  return (await res.json()).map(productFromRow)
}
export async function signInAdmin(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) })
  const data = await res.json(); if (!res.ok) throw new Error(data.msg || data.message || 'Login failed')
  return data
}
export async function adminRequest(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers(token), ...(init.headers || {}) } })
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message || data.msg || `Request failed (${res.status})`) }
  if (res.status === 204) return null
  return res.json()
}
export async function uploadProductImage(file: File, token: string) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-'); const path = `${Date.now()}-${safe}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file })
  if (!res.ok) throw new Error('Image upload failed. Check product-images storage bucket policies.')
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}


export interface CodOrderItem {
  handle: string
  size: string
  colour?: string
  variant_id?: string
  quantity: number
}

export interface CodOrderInput {
  customer_name: string
  email: string
  phone: string
  address: string
  city: string
  postal_code: string
  notes: string
  idempotency_key: string
  items: CodOrderItem[]
}

export interface CodOrderResult {
  order_id: string
  order_number: number
  total: number
}

export async function submitCodOrder(order: CodOrderInput): Promise<CodOrderResult> {
  if (!backendReady) throw new Error('Checkout is not connected yet. Please contact HALA.S support.')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_cod_order`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_customer_name: order.customer_name,
      p_email: order.email,
      p_phone: order.phone,
      p_address: order.address,
      p_city: order.city,
      p_postal_code: order.postal_code,
      p_notes: order.notes,
      p_idempotency_key: order.idempotency_key,
      // Never send or trust browser-calculated prices or totals.
      p_items: order.items,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.message || data?.details || data?.hint
    throw new Error(message || `Order could not be submitted (${res.status}). Please try again.`)
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.order_id || row?.order_number == null) {
    throw new Error('The store did not return an order confirmation. Please contact HALA.S before trying again.')
  }
  return { order_id: row.order_id, order_number: Number(row.order_number), total: Number(row.total) }
}
