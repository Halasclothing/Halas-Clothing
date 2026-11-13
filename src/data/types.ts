export type CollectionHandle = string

export type BaseCollection = string

export interface ImageRef {
  src: string
  small: string
  width: number
  height: number
  alt: string
  kind: 'catalog' | 'campaign' | 'craft'
}

export interface SizeOption {
  label: string
  available: boolean
}

export interface ProductVariant {
  id: string
  sku: string
  size: string
  colour: string
  colourHex: string
  price?: number
  compareAtPrice?: number
  quantity: number
  available: boolean
}

export interface Product {
  id: string
  handle: string
  title: string
  colourName: string
  colourHex: string
  price: number
  compareAtPrice?: number
  currency: 'PKR'
  fabric: string
  care: string
  description: string
  images: ImageRef[]
  sizes: SizeOption[]
  collections: BaseCollection[]
  releasedAt: string
  variants?: ProductVariant[]
  stock?: number
  tags?: string[]
  vendor?: string
  category?: string
  seoTitle?: string
  seoDescription?: string
}

export interface CollectionMeta {
  handle: CollectionHandle
  title: string
  tagline: string
  description?: string
  image: ImageRef
  seoTitle?: string
  seoDescription?: string
  automatic?: boolean
}
