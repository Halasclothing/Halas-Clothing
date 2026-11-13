import { renderEmail } from '../../supabase/functions/send-emails/templates.ts'

let passed = 0
const failures = []
const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1
    console.log(`  ok  ${label}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const payload = {
  order_id: 'abc',
  order_number: 1042,
  customer_name: 'Ayesha Khan',
  email: 'ayesha@example.com',
  phone: '0300 1234567',
  address: 'House 4, Street 7, Gulberg III',
  city: 'Lahore',
  postal_code: '54000',
  country: 'Pakistan',
  customer_notes: 'Please call before delivery <script>alert(1)</script>',
  subtotal: 29800,
  shipping_fee: 250,
  tax_total: 0,
  total: 30050,
  currency: 'PKR',
  payment_method: 'cod',
  payment_status: 'pending',
  order_status: 'new',
  placed_at: '2026-11-11T10:30:00Z',
  items: [
    {
      title: 'Zohra Chikankari Midi Dress',
      variant: 'M',
      size: 'M',
      colour: '',
      sku: 'HLS-ZOHRA-M',
      quantity: 2,
      unit_price: 14900,
      line_total: 29800,
    },
  ],
  admin_url: 'https://halas.test/admin/orders/abc',
  store_name: 'HALA.S CLOTHING',
  support_email: 'care@halas.test',
  courier_name: 'TCS',
  tracking_number: 'TCS-778899',
  tracking_url: 'https://tcs.example/track/778899',
  expected_delivery_date: '2026-11-13',
  delivery_status: 'shipped',
}

console.log('Admin new order')
const admin = renderEmail('admin_new_order', payload)
check('includes the order number', admin.html.includes('#1042'))
check('includes customer name and phone', admin.html.includes('Ayesha Khan') && admin.html.includes('0300 1234567'))
check('includes the full delivery address', admin.html.includes('Gulberg III') && admin.html.includes('Lahore'))
check('includes item size and quantity', admin.html.includes('Zohra Chikankari Midi Dress') && admin.html.includes('>2<'))
check('includes total and shipping', admin.html.includes('PKR 30,050') && admin.html.includes('PKR 250'))
check('includes the admin deep link', admin.html.includes('https://halas.test/admin/orders/abc'))
check('escapes customer input', !admin.html.includes('<script>') && admin.html.includes('&lt;script&gt;'))
check('plain text version contains the address', admin.text.includes('Gulberg III'))

console.log('Customer emails')
const confirmation = renderEmail('customer_order_confirmation', payload)
check('confirmation thanks the customer by name', confirmation.html.includes('Thank you, Ayesha Khan'))
check('confirmation states cash on delivery', confirmation.html.includes('Cash on Delivery'))
const shipment = renderEmail('customer_shipment_notification', payload)
check('shipment includes courier and tracking', shipment.html.includes('TCS') && shipment.html.includes('TCS-778899'))
check('shipment includes the tracking link', shipment.html.includes('https://tcs.example/track/778899'))
const delivered = renderEmail('customer_delivery_confirmation', payload)
check('delivery confirmation references the order', delivered.html.includes('#1042'))
const status = renderEmail('customer_order_status', payload)
check('status email humanises the status', status.html.includes('New'))

console.log('Admin operational emails')
const cancelled = renderEmail('admin_order_cancelled', payload)
check('cancelled alert includes order and total', cancelled.html.includes('#1042') && cancelled.html.includes('PKR 30,050'))
const returned = renderEmail('admin_order_returned', payload)
check('returned alert is rendered', returned.html.includes('returned'))
const failed = renderEmail('admin_delivery_failed', { ...payload, delivery_notes: 'Address not found' })
check('failed delivery includes courier and note', failed.html.includes('TCS-778899') && failed.html.includes('Address not found'))
const stock = renderEmail('admin_low_stock', {
  ...payload,
  product_title: 'Zohra Chikankari Midi Dress',
  variant_label: 'Zohra Chikankari Midi Dress — M',
  available: 2,
  threshold: 3,
  sku: 'HLS-ZOHRA-M',
  product_url: 'https://halas.test/admin/products/p1',
})
check('low stock alert includes availability', stock.html.includes('2 available') && stock.html.includes('threshold 3'))
const out = renderEmail('admin_out_of_stock', {
  ...payload,
  product_title: 'Zohra Chikankari Midi Dress',
  variant_label: 'Zohra Chikankari Midi Dress — M',
  available: 0,
})
check('out of stock alert is rendered', out.html.includes('out of stock'))
const test = renderEmail('test_email', { ...payload, message: 'Test message' })
check('test email confirms delivery works', test.html.includes('Email delivery is working'))
const error = renderEmail('system_error', { ...payload, message: 'Worker exploded', context: { queue: 'email' } })
check('system error includes the reported message', error.html.includes('Worker exploded'))

console.log(`\n${passed} checks passed, ${failures.length} failed`)
if (failures.length) {
  failures.forEach((failure) => console.error(` - ${failure}`))
  process.exitCode = 1
}
