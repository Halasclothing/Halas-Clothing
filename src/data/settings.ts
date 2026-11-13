export interface StorefrontSettings {
  storeName: string
  currency: string
  codEnabled: boolean
  shippingFee: number
  freeShippingThreshold: number
  taxRate: number
  supportEmail: string
  phone: string
  whatsapp: string
  address: string
}

export const shippingFor = (subtotal: number, settings: StorefrontSettings): number => {
  if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) return 0
  return settings.shippingFee
}
