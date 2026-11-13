import { supabase } from '../lib/supabase'

export type ProductStatus = 'draft' | 'published' | 'archived'

export interface AdminImage {
  id?: string
  url: string
  storage_path?: string | null
  alt?: string
  position?: number
  is_primary?: boolean
}

export interface InventoryLevel {
  quantity: number
  reserved_quantity: number
  available_quantity: number
  low_stock_threshold: number | null
}

export interface AdminVariant {
  id?: string
  product_id?: string
  sku?: string | null
  title?: string
  size: string
  colour: string
  colour_hex?: string
  price?: number | null
  compare_at_price?: number | null
  position?: number
  is_active?: boolean
  inventory_levels?: InventoryLevel | InventoryLevel[] | null
}

export interface AdminProduct {
  id: string
  handle: string
  title: string
  description: string
  fabric: string
  care: string
  brand: string
  vendor: string
  category: string
  product_type: string
  status: ProductStatus
  price: number
  compare_at_price: number | null
  cost_per_item: number | null
  sku: string | null
  tags: string[] | null
  search_keywords: string[] | null
  seo_title: string
  seo_description: string
  featured: boolean
  released_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  product_images: AdminImage[]
  product_variants: AdminVariant[]
}

export interface AdminCollection {
  id: string
  handle: string
  title: string
  description: string
  image_url: string
  seo_title: string
  seo_description: string
  status: ProductStatus
  is_automatic: boolean
  rules: CollectionRules | null
  position: number
  created_at: string
  updated_at: string
  collection_products?: { product_id: string; position?: number }[]
}

export interface RuleCondition {
  field: string
  operator: string
  value: string | number | boolean
}

export interface CollectionRules {
  match: 'all' | 'any'
  conditions: RuleCondition[]
}

export interface AdminOrderItem {
  id: string
  title: string
  variant_title: string
  size: string
  colour: string
  sku: string
  image_url: string
  unit_price: number
  quantity: number
  line_total: number
  product_id: string | null
}

export type OrderStatus =
  | 'new'
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type DeliveryStatus =
  | 'pending'
  | 'ready_to_dispatch'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled'

export interface AdminDelivery {
  id: string
  order_id: string
  courier_name: string
  tracking_number: string
  tracking_url: string
  dispatch_date: string | null
  expected_delivery_date: string | null
  delivered_at: string | null
  delivery_charges: number
  status: DeliveryStatus
  notes: string
  updated_at: string
}

export interface AdminPayment {
  id: string
  method: string
  amount: number
  status: PaymentStatus
  reference: string
  note: string
  created_at: string
}

export interface AdminOrder {
  id: string
  order_number: number
  customer_id: string | null
  customer_name: string
  email: string
  phone: string
  address: string
  city: string
  postal_code: string
  country: string
  customer_notes: string
  internal_notes: string
  subtotal: number
  shipping_fee: number
  tax_total: number
  discount_total: number
  total: number
  currency: string
  payment_method: string
  payment_status: PaymentStatus
  order_status: OrderStatus
  stock_reserved: boolean
  stock_deducted: boolean
  placed_at: string
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  returned_at: string | null
  updated_at: string
  order_items?: AdminOrderItem[]
  delivery_records?: AdminDelivery | AdminDelivery[] | null
  payment_records?: AdminPayment[]
}

export interface AdminCustomer {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  accepts_marketing: boolean
  created_at: string
  updated_at: string
}

export interface AdminInventoryRow {
  variant: AdminVariant & { product_id: string; sku: string | null }
  product: { id: string; title: string; handle: string; status: ProductStatus; category: string; image_url: string }
  level: InventoryLevel
}

export interface AdminMovement {
  id: string
  variant_id: string
  type: string
  quantity_change: number
  reserved_change: number
  quantity_after: number
  reserved_after: number
  reason: string
  actor_email: string
  created_at: string
}

export interface AdminEmailLog {
  id: string
  event_type: string
  audience: 'admin' | 'customer'
  recipient: string
  template: string
  subject: string
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
  attempts: number
  last_error: string
  provider_message_id: string
  order_id: string | null
  created_at: string
  sent_at: string | null
  next_attempt_at: string
}

export interface NotificationPreference {
  event_type: string
  label: string
  audience: 'admin' | 'customer'
  enabled: boolean
}

export interface StoreSettings {
  store_name: string
  brand_mark: string
  support_email: string
  admin_notification_email: string
  phone: string
  whatsapp: string
  address: string
  currency: string
  cod_enabled: boolean
  shipping_fee: number
  free_shipping_threshold: number
  tax_rate: number
  prices_include_tax: boolean
  low_stock_threshold: number
  restock_cancelled: boolean
  restock_returned: boolean
  timezone: string
  store_url: string
  seo_title: string
  seo_description: string
  updated_at: string
}

export interface Analytics {
  range: { from: string; to: string; timezone: string }
  revenue: number
  orders: number
  sales_orders: number
  units: number
  average_order: number
  cancelled: number
  returned: number
  pending: number
  awaiting_dispatch: number
  out_for_delivery: number
  delivered: number
  low_stock_count: number
  today_orders: number
  week_orders: number
  week_sales: number
  month_orders: number
  month_sales: number
  series: { date: string; revenue: number; orders: number }[]
  best_sellers: { product_id: string; title: string; units: number; revenue: number }[]
  low_stock: {
    variant_id: string
    product_id: string
    title: string
    variant: string | null
    sku: string | null
    quantity: number
    reserved: number
    available: number
    threshold: number
  }[]
  recent_orders: {
    id: string
    order_number: number
    customer_name: string
    total: number
    order_status: OrderStatus
    payment_status: PaymentStatus
    placed_at: string
    city: string
    item_count: number
  }[]
  status_breakdown: Record<string, number>
  activity: {
    id: string
    action: string
    entity_type: string
    entity_id: string
    actor_email: string
    details: Record<string, unknown>
    created_at: string
  }[]
}

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'pending_confirmation', label: 'Pending confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
]

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

export const DELIVERY_STATUSES: { value: DeliveryStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'ready_to_dispatch', label: 'Ready to dispatch' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed_delivery', label: 'Failed delivery' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const RULE_FIELDS: {
  value: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'status'
}[] = [
  { value: 'tag', label: 'Tag', type: 'text' },
  { value: 'keyword', label: 'Search keyword', type: 'text' },
  { value: 'category', label: 'Category', type: 'text' },
  { value: 'vendor', label: 'Vendor', type: 'text' },
  { value: 'brand', label: 'Brand', type: 'text' },
  { value: 'product_type', label: 'Product type', type: 'text' },
  { value: 'title', label: 'Title', type: 'text' },
  { value: 'price', label: 'Price', type: 'number' },
  { value: 'compare_at_price', label: 'Compare-at price', type: 'number' },
  { value: 'inventory', label: 'Available inventory', type: 'number' },
  { value: 'colour', label: 'Colour', type: 'text' },
  { value: 'on_sale', label: 'On sale', type: 'boolean' },
  { value: 'status', label: 'Product status', type: 'status' },
  { value: 'released_within_days', label: 'Released within days', type: 'number' },
]

export const RULE_OPERATORS: { value: string; label: string }[] = [
  { value: 'equals', label: 'is equal to' },
  { value: 'not_equals', label: 'is not equal to' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is at most' },
]

export const operatorsFor = (fieldType: string) =>
  fieldType === 'number'
    ? RULE_OPERATORS.filter((operator) =>
        ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte'].includes(operator.value),
      )
    : RULE_OPERATORS.filter((operator) =>
        ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with'].includes(operator.value),
      )

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['pending_confirmation', 'confirmed', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'packed', 'shipped', 'cancelled'],
  processing: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'out_for_delivery', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'returned', 'cancelled'],
  out_for_delivery: ['delivered', 'returned', 'cancelled'],
  delivered: ['returned'],
  cancelled: ['returned'],
  returned: [],
}

const fail = (error: { message?: string; details?: string; hint?: string } | null) => {
  if (!error) return
  throw new Error(error.message || error.details || error.hint || 'The request could not be completed.')
}

export const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null)

export const levelOf = (variant: AdminVariant | null | undefined): InventoryLevel => {
  const level = one(variant?.inventory_levels ?? null)
  const quantity = Number(level?.quantity ?? 0)
  const reserved = Number(level?.reserved_quantity ?? 0)
  return {
    quantity,
    reserved_quantity: reserved,
    available_quantity: Number(level?.available_quantity ?? Math.max(0, quantity - reserved)),
    low_stock_threshold: level?.low_stock_threshold ?? null,
  }
}

export const deliveryOf = (order: AdminOrder): AdminDelivery | null => one(order.delivery_records ?? null)

export async function callRpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  fail(error)
  return data as T
}

const productSelection = '*, product_images(*), product_variants(*, inventory_levels(*))'

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select(productSelection)
    .order('created_at', { ascending: false })
  fail(error)
  return ((data ?? []) as AdminProduct[]).map((product) => ({
    ...product,
    product_images: [...(product.product_images ?? [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.position) - Number(b.position),
    ),
    product_variants: [...(product.product_variants ?? [])].sort(
      (a, b) => Number(a.position) - Number(b.position),
    ),
  }))
}

export async function getAdminProduct(id: string): Promise<AdminProduct> {
  const { data, error } = await supabase.from('products').select(productSelection).eq('id', id).single()
  fail(error)
  const product = data as AdminProduct
  return {
    ...product,
    product_images: [...(product.product_images ?? [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.position) - Number(b.position),
    ),
    product_variants: [...(product.product_variants ?? [])].sort(
      (a, b) => Number(a.position) - Number(b.position),
    ),
  }
}

export async function saveProduct(input: {
  product: Record<string, unknown>
  images: AdminImage[]
  variants: Record<string, unknown>[]
}): Promise<string> {
  return callRpc<string>('admin_save_product', {
    p_product: input.product,
    p_images: input.images,
    p_variants: input.variants,
  })
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<void> {
  await callRpc('admin_set_product_status', { p_product_id: id, p_status: status })
}

export async function duplicateProduct(id: string): Promise<string> {
  return callRpc<string>('admin_duplicate_product', { p_product_id: id })
}

export async function deleteProduct(id: string): Promise<void> {
  await callRpc('admin_delete_product', { p_product_id: id })
}

export async function listAdminCollections(): Promise<AdminCollection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*, collection_products(product_id, position)')
    .order('position')
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []) as AdminCollection[]
}

export async function getAdminCollection(id: string): Promise<AdminCollection> {
  const { data, error } = await supabase
    .from('collections')
    .select('*, collection_products(product_id, position)')
    .eq('id', id)
    .single()
  fail(error)
  return data as AdminCollection
}

export async function listProductOptions(): Promise<
  { id: string; title: string; handle: string; status: ProductStatus; price: number; image_url: string }[]
> {
  const { data, error } = await supabase
    .from('products')
    .select('id,title,handle,status,price,product_images(url,is_primary,position)')
    .order('title')
  fail(error)
  return ((data ?? []) as any[]).map((row) => {
    const images = [...(row.product_images ?? [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.position) - Number(b.position),
    )
    return {
      id: row.id,
      title: row.title,
      handle: row.handle,
      status: row.status,
      price: Number(row.price),
      image_url: images[0]?.url ?? '',
    }
  })
}

export async function saveCollection(input: {
  collection: Record<string, unknown>
  productIds: string[]
}): Promise<string> {
  return callRpc<string>('admin_save_collection', {
    p_collection: input.collection,
    p_product_ids: input.productIds,
  })
}

export async function deleteCollection(id: string): Promise<void> {
  await callRpc('admin_delete_collection', { p_collection_id: id })
}

export async function previewCollection(
  rules: CollectionRules,
): Promise<{ product_id: string; title: string; handle: string; price: number; image_url: string; status: string }[]> {
  return callRpc('admin_collection_preview', { p_rules: rules })
}

export interface OrderFilters {
  search?: string
  status?: OrderStatus | 'all'
  payment?: PaymentStatus | 'all'
  from?: string
  to?: string
}

const searchTerm = (value: string) => value.trim().replace(/[^a-zA-Z0-9@. _+-]/g, '')

export async function listAdminOrders(filters: OrderFilters = {}): Promise<AdminOrder[]> {
  let query: any = supabase
    .from('orders')
    .select('*, order_items(*), delivery_records(*), payment_records(*)')
    .order('placed_at', { ascending: false })
    .limit(300)

  if (filters.status && filters.status !== 'all') query = query.eq('order_status', filters.status)
  if (filters.payment && filters.payment !== 'all') query = query.eq('payment_status', filters.payment)
  if (filters.from) query = query.gte('placed_at', `${filters.from}T00:00:00`)
  if (filters.to) query = query.lte('placed_at', `${filters.to}T23:59:59.999`)

  const term = searchTerm(filters.search ?? '')
  if (term) {
    const clauses = [
      `customer_name.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `city.ilike.%${term}%`,
    ]
    if (/^\d+$/.test(term)) clauses.push(`order_number.eq.${term}`)
    query = query.or(clauses.join(','))
  }

  const { data, error } = await query
  fail(error)
  return (data ?? []) as AdminOrder[]
}

export async function getAdminOrder(id: string): Promise<AdminOrder> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), delivery_records(*), payment_records(*)')
    .eq('id', id)
    .single()
  fail(error)
  return data as AdminOrder
}

export async function getOrderHistory(orderId: string) {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []) as {
    id: string
    field: string
    from_value: string | null
    to_value: string | null
    note: string
    actor_email: string
    created_at: string
  }[]
}

export async function getDeliveryEvents(deliveryId: string) {
  const { data, error } = await supabase
    .from('delivery_events')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: false })
  fail(error)
  return (data ?? []) as {
    id: string
    status: string
    note: string
    actor_email: string
    created_at: string
  }[]
}

export async function updateOrderStatus(id: string, status: OrderStatus, note = ''): Promise<void> {
  await callRpc('admin_update_order_status', { p_order_id: id, p_status: status, p_note: note })
}

export async function updateOrderPayment(
  id: string,
  status: PaymentStatus,
  reference = '',
  note = '',
): Promise<void> {
  await callRpc('admin_update_payment', {
    p_order_id: id,
    p_status: status,
    p_reference: reference,
    p_note: note,
  })
}

export async function updateOrderNotes(
  id: string,
  internalNotes: string,
  customerNotes: string,
): Promise<void> {
  await callRpc('admin_update_order_notes', {
    p_order_id: id,
    p_internal_notes: internalNotes,
    p_customer_notes: customerNotes,
  })
}

export async function bulkUpdateOrderStatus(ids: string[], status: OrderStatus, note = ''): Promise<number> {
  return callRpc<number>('admin_bulk_update_order_status', {
    p_order_ids: ids,
    p_status: status,
    p_note: note,
  })
}

export interface DeliveryUpdateInput {
  courierName: string
  trackingNumber: string
  trackingUrl: string
  dispatchDate: string
  expectedDeliveryDate: string
  deliveryCharges: string
  status: DeliveryStatus | ''
  notes: string
  eventNote: string
}

export async function updateDelivery(orderId: string, input: DeliveryUpdateInput): Promise<void> {
  await callRpc('admin_update_delivery', {
    p_order_id: orderId,
    p_courier_name: input.courierName,
    p_tracking_number: input.trackingNumber,
    p_tracking_url: input.trackingUrl,
    p_dispatch_date: input.dispatchDate || null,
    p_expected_delivery_date: input.expectedDeliveryDate || null,
    p_delivery_charges: input.deliveryCharges === '' ? null : Number(input.deliveryCharges),
    p_status: input.status || null,
    p_notes: input.notes,
    p_event_note: input.eventNote,
  })
}

export interface AdminDeliveryRow {
  order: AdminOrder
  delivery: AdminDelivery
}

export async function listDeliveries(): Promise<AdminDeliveryRow[]> {
  const { data, error } = await supabase
    .from('delivery_records')
    .select(
      '*, orders(*, order_items(*))',
    )
    .order('updated_at', { ascending: false })
  fail(error)
  return ((data ?? []) as any[]).map((row) => ({
    order: row.orders as AdminOrder,
    delivery: row as AdminDelivery,
  }))
}

export async function listCustomers(search = ''): Promise<
  (AdminCustomer & { order_count: number; lifetime_spend: number; last_order_at: string | null })[]
> {
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(500)
  fail(error)
  const customers = (data ?? []) as AdminCustomer[]

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('customer_id,total,order_status,placed_at')
  fail(ordersError)

  const stats = new Map<string, { count: number; spend: number; last: string | null }>()
  for (const order of orders ?? []) {
    if (!order.customer_id) continue
    const current = stats.get(order.customer_id) ?? { count: 0, spend: 0, last: null }
    current.count += 1
    if (order.order_status !== 'cancelled' && order.order_status !== 'returned') {
      current.spend += Number(order.total || 0)
    }
    if (!current.last || order.placed_at > current.last) current.last = order.placed_at
    stats.set(order.customer_id, current)
  }

  const term = search.trim().toLowerCase()
  return customers
    .filter(
      (customer) =>
        !term ||
        customer.name.toLowerCase().includes(term) ||
        customer.phone.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term),
    )
    .map((customer) => {
      const stat = stats.get(customer.id)
      return {
        ...customer,
        order_count: stat?.count ?? 0,
        lifetime_spend: stat?.spend ?? 0,
        last_order_at: stat?.last ?? null,
      }
    })
}

export async function getCustomerDetail(id: string) {
  const [{ data: customer, error }, { data: addresses, error: addressError }, { data: orders, error: orderError }] =
    await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('customer_addresses').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', id)
        .order('placed_at', { ascending: false }),
    ])
  fail(error)
  fail(addressError)
  fail(orderError)
  return {
    customer: customer as AdminCustomer,
    addresses: (addresses ?? []) as {
      id: string
      label: string
      address: string
      city: string
      postal_code: string
      country: string
    }[],
    orders: (orders ?? []) as AdminOrder[],
  }
}

export async function updateCustomer(
  id: string,
  input: { name: string; email: string; phone: string; notes: string },
): Promise<void> {
  await callRpc('admin_update_customer', {
    p_customer_id: id,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_notes: input.notes,
  })
}

export async function listInventory(): Promise<AdminInventoryRow[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'id,product_id,sku,title,size,colour,colour_hex,price,is_active,position,inventory_levels(quantity,reserved_quantity,available_quantity,low_stock_threshold),products(id,title,handle,status,category,product_images(url,is_primary,position))',
    )
    .eq('is_active', true)
  fail(error)

  return ((data ?? []) as any[])
    .map((row) => {
      const images = [...(row.products?.product_images ?? [])].sort(
        (a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || Number(a.position) - Number(b.position),
      )
      return {
        variant: row as AdminVariant & { product_id: string; sku: string | null },
        product: {
          id: row.products?.id ?? row.product_id,
          title: row.products?.title ?? 'Unknown product',
          handle: row.products?.handle ?? '',
          status: row.products?.status ?? 'draft',
          category: row.products?.category ?? '',
          image_url: images[0]?.url ?? '',
        },
        level: levelOf(row),
      }
    })
    .sort((a, b) => a.product.title.localeCompare(b.product.title) || (a.variant.position ?? 0) - (b.variant.position ?? 0))
}

export async function adjustInventory(variantId: string, delta: number, reason: string): Promise<number> {
  return callRpc<number>('admin_adjust_inventory', {
    p_variant_id: variantId,
    p_quantity_delta: delta,
    p_reason: reason,
  })
}

export async function listMovements(variantId?: string, limit = 25): Promise<AdminMovement[]> {
  let query: any = supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(limit)
  if (variantId) query = query.eq('variant_id', variantId)
  const { data, error } = await query
  fail(error)
  return (data ?? []) as AdminMovement[]
}

export async function getAnalytics(from: Date, to: Date): Promise<Analytics> {
  return callRpc<Analytics>('admin_analytics', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
}

export async function listEmailLog(limit = 200): Promise<AdminEmailLog[]> {
  const { data, error } = await supabase
    .from('email_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  fail(error)
  return (data ?? []) as AdminEmailLog[]
}

export async function retryEmail(id: string): Promise<void> {
  await callRpc('admin_retry_email', { p_id: id })
}

export async function sendTestEmail(recipient: string): Promise<void> {
  await callRpc('admin_send_test_email', { p_recipient: recipient || null })
}

export async function listNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .order('audience')
    .order('event_type')
  fail(error)
  return (data ?? []) as NotificationPreference[]
}

export async function setNotificationPreference(eventType: string, enabled: boolean): Promise<void> {
  await callRpc('admin_update_notification_preference', {
    p_event_type: eventType,
    p_enabled: enabled,
  })
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single()
  fail(error)
  return data as StoreSettings
}

export async function updateStoreSettings(settings: Partial<StoreSettings>): Promise<void> {
  await callRpc('admin_update_settings', { p_settings: settings })
}

export async function listActivity(limit = 40) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  fail(error)
  return (data ?? []) as {
    id: string
    action: string
    entity_type: string
    entity_id: string
    actor_email: string
    details: Record<string, unknown>
    created_at: string
  }[]
}

async function optimizeProductImage(file: File): Promise<File> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return file

  try {
    const bitmap = await createImageBitmap(file)
    const maxEdge = 1800
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.84),
    )
    if (!blob || blob.size >= file.size) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    // Keep uploads working on browsers that cannot decode or encode WebP.
    return file
  }
}

export async function uploadImage(file: File, folder = 'products'): Promise<{ path: string; url: string }> {
  const optimized = await optimizeProductImage(file)
  const extension = optimized.type === 'image/webp'
    ? 'webp'
    : (optimized.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const path = `${folder}/${new Date().getFullYear()}/${unique}.${extension || 'jpg'}`
  const { error } = await supabase.storage.from('product-images').upload(path, optimized, {
    cacheControl: '31536000',
    upsert: false,
    contentType: optimized.type || file.type,
  })
  fail(error)
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function removeImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from('product-images').remove([path])
  fail(error)
}

export async function reportSystemError(message: string, context: Record<string, unknown> = {}): Promise<void> {
  await callRpc('report_system_error', { p_message: message, p_context: context })
}
