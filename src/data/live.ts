import { supabase, backendReady } from '../lib/supabase'
import type { CollectionMeta, ImageRef, Product, ProductVariant, SizeOption } from './types'
import type { StorefrontSettings } from './settings'

const CACHE_MS = 20_000
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

interface LiveCatalogue {
  products: Product[]
  collections: CollectionMeta[]
  membership: Map<string, Set<string>>
  fetchedAt: number
}

let cache: LiveCatalogue | null = null
let inflight: Promise<LiveCatalogue | null> | null = null

export const invalidateLiveCatalogue = () => {
  cache = null
  inflight = null
}

const fallbackImage = (alt: string): ImageRef => ({
  src: '/images/campaign/hero-wide.jpg',
  small: '/images/campaign/hero-wide-420.jpg',
  width: 1792,
  height: 1024,
  alt,
  kind: 'campaign',
})

const toImage = (row: any, fallbackAlt: string): ImageRef => {
  const url = String(row?.url ?? '')
  if (!url) return fallbackImage(fallbackAlt)
  return {
    src: url,
    small: url,
    width: 1024,
    height: 1280,
    alt: String(row?.alt ?? '') || fallbackAlt,
    kind: 'catalog',
  }
}

const levelOf = (variant: any) => {
  const level = Array.isArray(variant?.inventory_levels)
    ? variant.inventory_levels[0]
    : variant?.inventory_levels
  const quantity = Number(level?.quantity ?? 0)
  const reserved = Number(level?.reserved_quantity ?? 0)
  const available = Number(level?.available_quantity ?? quantity - reserved)
  return { quantity, available: Math.max(0, available) }
}

const mapProduct = (row: any, collections: string[]): Product => {
  const images = (row.product_images ?? [])
    .slice()
    .sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || Number(a.position) - Number(b.position))
    .map((image: any) => toImage(image, row.title))

  const variants: ProductVariant[] = (row.product_variants ?? [])
    .filter((variant: any) => variant.is_active !== false)
    .slice()
    .sort((a: any, b: any) => Number(a.position) - Number(b.position))
    .map((variant: any) => {
      const level = levelOf(variant)
      return {
        id: variant.id,
        sku: String(variant.sku ?? ''),
        size: String(variant.size ?? ''),
        colour: String(variant.colour ?? ''),
        colourHex: String(variant.colour_hex ?? ''),
        price: variant.price == null ? undefined : Number(variant.price),
        compareAtPrice: variant.compare_at_price == null ? undefined : Number(variant.compare_at_price),
        quantity: level.quantity,
        available: level.available > 0,
      }
    })

  const sizes: SizeOption[] = []
  for (const variant of variants) {
    if (!variant.size) continue
    const existing = sizes.find((size) => size.label === variant.size)
    if (existing) existing.available = existing.available || variant.available
    else sizes.push({ label: variant.size, available: variant.available })
  }
  sizes.sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.label.toUpperCase())
    const bi = SIZE_ORDER.indexOf(b.label.toUpperCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  if (sizes.length === 0) {
    sizes.push({ label: 'One size', available: variants.some((variant) => variant.available) })
  }

  const primaryColour = variants.find((variant) => variant.colour)?.colour || 'Multi'
  const primaryHex = variants.find((variant) => variant.colourHex)?.colourHex || '#c8b9a5'
  const stock = variants.reduce((total, variant) => total + (variant.available ? 1 : 0), 0)

  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    colourName: primaryColour,
    colourHex: primaryHex,
    price: Number(row.price ?? 0),
    compareAtPrice: row.compare_at_price == null ? undefined : Number(row.compare_at_price),
    currency: 'PKR',
    fabric: row.fabric ?? '',
    care: row.care ?? '',
    description: row.description ?? '',
    images: images.length ? images : [fallbackImage(row.title)],
    sizes,
    collections,
    releasedAt: row.released_at ?? row.published_at ?? row.created_at ?? new Date().toISOString(),
    variants,
    stock,
    tags: row.tags ?? [],
    vendor: row.vendor ?? '',
    category: row.category ?? '',
    seoTitle: row.seo_title ?? '',
    seoDescription: row.seo_description ?? '',
  }
}

const mapCollection = (row: any): CollectionMeta => ({
  handle: row.handle,
  title: row.title,
  tagline: row.description ?? '',
  description: row.description ?? '',
  image: row.image_url
    ? { src: row.image_url, small: row.image_url, width: 1024, height: 1280, alt: row.title, kind: 'catalog' }
    : fallbackImage(row.title),
  seoTitle: row.seo_title ?? '',
  seoDescription: row.seo_description ?? '',
  automatic: Boolean(row.is_automatic),
})

const fetchCatalogue = async (): Promise<LiveCatalogue | null> => {
  if (!backendReady) return null
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const [productResult, collectionResult, membershipResult] = await Promise.all([
        supabase
          .from('products')
          .select(
            `id,handle,title,description,fabric,care,category,vendor,brand,tags,search_keywords,
             seo_title,seo_description,price,compare_at_price,released_at,published_at,created_at,featured,
             product_images(url,alt,position,is_primary),
             product_variants(id,sku,size,colour,colour_hex,price,compare_at_price,position,is_active,
               inventory_levels(quantity,reserved_quantity,available_quantity))`,
          )
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('collections')
          .select('id,handle,title,description,image_url,seo_title,seo_description,is_automatic,status,position')
          .eq('status', 'published')
          .order('position'),
        supabase
          .from('collection_products_effective')
          .select('collection_handle,product_id'),
      ])

      if (productResult.error) throw productResult.error
      if (collectionResult.error) throw collectionResult.error
      if (membershipResult.error) throw membershipResult.error

      const membership = new Map<string, Set<string>>()
      for (const row of membershipResult.data ?? []) {
        const handle = String(row.collection_handle)
        if (!membership.has(handle)) membership.set(handle, new Set())
        membership.get(handle)!.add(String(row.product_id))
      }

      const products = (productResult.data ?? []).map((row: any) => {
        const handles = [...membership.entries()]
          .filter(([, ids]) => ids.has(row.id))
          .map(([handle]) => handle)
        return mapProduct(row, handles)
      })

      const collections = (collectionResult.data ?? []).map(mapCollection)
      cache = { products, collections, membership, fetchedAt: Date.now() }
      return cache
    } catch (error) {
      console.warn('[HALA.S] Live catalogue unavailable; using bundled data.', error)
      return null
    } finally {
      inflight = null
    }
  })()

  return inflight
}

export const fetchLiveCatalogue = fetchCatalogue

export const fetchLiveProduct = async (handle: string): Promise<Product | null> => {
  if (!backendReady) return null

  const { data, error } = await supabase
    .from('products')
    .select(
      `id,handle,title,description,fabric,care,category,vendor,brand,tags,search_keywords,
       seo_title,seo_description,price,compare_at_price,released_at,published_at,created_at,featured,
       product_images(url,alt,position,is_primary),
       product_variants(id,sku,size,colour,colour_hex,price,compare_at_price,position,is_active,
         inventory_levels(quantity,reserved_quantity,available_quantity))`,
    )
    .eq('handle', handle)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // Collection membership is supplementary to the product detail itself. A
  // collection-view permission/configuration issue must not hide a published PDP.
  const membershipResult = await supabase
    .from('collection_products_effective')
    .select('collection_handle')
    .eq('product_id', data.id)

  const collections = membershipResult.error
    ? []
    : [...new Set((membershipResult.data ?? []).map((row: any) => String(row.collection_handle)))]

  return mapProduct(data, collections)
}

export const fetchLiveCollection = async (handle: string) => {
  const data = await fetchCatalogue()
  if (!data) return null
  const meta = data.collections.find((collection) => collection.handle === handle)
  if (!meta) return null
  const ids = data.membership.get(handle) ?? new Set<string>()
  return { meta, products: data.products.filter((product) => ids.has(product.id)) }
}

const defaultSettings: StorefrontSettings = {
  storeName: 'HALA.S CLOTHING',
  currency: 'PKR',
  codEnabled: true,
  shippingFee: 0,
  freeShippingThreshold: 0,
  taxRate: 0,
  supportEmail: '',
  phone: '',
  whatsapp: '',
  address: '',
}

export const fetchStorefrontSettings = async (): Promise<StorefrontSettings> => {
  if (!backendReady) return defaultSettings
  const { data, error } = await supabase.from('storefront_settings').select('*').maybeSingle()
  if (error || !data) return defaultSettings
  return {
    storeName: data.store_name ?? defaultSettings.storeName,
    currency: data.currency ?? 'PKR',
    codEnabled: data.cod_enabled !== false,
    shippingFee: Number(data.shipping_fee ?? 0),
    freeShippingThreshold: Number(data.free_shipping_threshold ?? 0),
    taxRate: Number(data.tax_rate ?? 0),
    supportEmail: data.support_email ?? '',
    phone: data.phone ?? '',
    whatsapp: data.whatsapp ?? '',
    address: data.address ?? '',
  }
}
