import type { AdminDelivery, AdminOrder, StoreSettings } from './api'
import { dateOnly, dateTime, money } from './format'

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const baseStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; font-family: "Helvetica Neue", Arial, sans-serif; color: #16140f; background: #fff; font-size: 12px; line-height: 1.5; }
  h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; margin: 0; font-weight: 500; }
  h1 { font-size: 26px; letter-spacing: 0.02em; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 8px; }
  .muted { color: #6f695c; }
  .micro { font-size: 9px; text-transform: uppercase; letter-spacing: 0.18em; color: #6f695c; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; border-bottom: 1px solid #16140f; padding: 8px 6px; }
  td { border-bottom: 1px solid #e3ddcf; padding: 8px 6px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 260px; margin-top: 18px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 1px solid #16140f; margin-top: 6px; padding-top: 8px; font-size: 14px; font-weight: 600; }
  .address { white-space: pre-line; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e3ddcf; font-size: 10px; color: #6f695c; }
  .status { display: inline-block; border: 1px solid #16140f; padding: 2px 8px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 9px; }
  .slip-check { display: inline-block; width: 11px; height: 11px; border: 1px solid #16140f; }
  @media print { body { padding: 16px; } }
`

const shell = (title: string, body: string, extra = '') => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${baseStyles}${extra}</style></head><body>${body}</body></html>`

const orderNumberBlock = (order: AdminOrder, documentName: string) => `
  <div class="row">
    <div>
      <h1>${escapeHtml('HALA.S CLOTHING')}</h1>
    </div>
    <div style="text-align:right">
      <p class="micro">${escapeHtml(documentName)}</p>
      <h2 style="margin-top:6px">Order #${escapeHtml(order.order_number)}</h2>
      <p class="muted" style="margin:4px 0 0">${escapeHtml(dateOnly(order.placed_at))}</p>
    </div>
  </div>`

const billTo = (order: AdminOrder) => `
  <div class="row" style="margin-top:26px">
    <div style="flex:1">
      <p class="micro">Deliver to</p>
      <p style="margin:6px 0 0"><strong>${escapeHtml(order.customer_name)}</strong></p>
      <p class="address muted" style="margin:2px 0 0">${escapeHtml(order.address)}
${escapeHtml(order.city)} ${escapeHtml(order.postal_code)}
${escapeHtml(order.country)}</p>
      <p class="muted" style="margin:6px 0 0">${escapeHtml(order.phone)}</p>
      ${order.email ? `<p class="muted" style="margin:2px 0 0">${escapeHtml(order.email)}</p>` : ''}
    </div>
    <div style="width:220px">
      <p class="micro">Payment</p>
      <p style="margin:6px 0 0">Cash on Delivery</p>
      <p class="status" style="margin-top:8px">${escapeHtml(order.payment_status)}</p>
      <p class="micro" style="margin-top:16px">Order status</p>
      <p style="margin:4px 0 0">${escapeHtml(order.order_status.replace(/_/g, ' '))}</p>
    </div>
  </div>`

const totalsBlock = (order: AdminOrder) => `
  <div class="totals">
    <div><span class="muted">Subtotal</span><span>${escapeHtml(money(order.subtotal, order.currency))}</span></div>
    <div><span class="muted">Shipping</span><span>${escapeHtml(money(order.shipping_fee, order.currency))}</span></div>
    ${Number(order.tax_total) ? `<div><span class="muted">Tax</span><span>${escapeHtml(money(order.tax_total, order.currency))}</span></div>` : ''}
    ${Number(order.discount_total) ? `<div><span class="muted">Discount</span><span>-${escapeHtml(money(order.discount_total, order.currency))}</span></div>` : ''}
    <div class="grand"><span>Total due</span><span>${escapeHtml(money(order.total, order.currency))}</span></div>
  </div>`

const footer = (settings: StoreSettings | null) =>
  `<div class="footer">Thank you for shopping with ${escapeHtml(settings?.store_name ?? 'HALA.S CLOTHING')}. ${
    settings?.support_email ? `Questions? ${escapeHtml(settings.support_email)}` : ''
  }</div>`

export function invoiceHtml(order: AdminOrder, settings: StoreSettings | null): string {
  const items = (order.order_items ?? [])
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(
          [item.colour, item.size].filter(Boolean).join(' · '),
        )}</span>${item.sku ? `<br><span class="muted">SKU ${escapeHtml(item.sku)}</span>` : ''}</td>
        <td class="num">${escapeHtml(item.quantity)}</td>
        <td class="num">${escapeHtml(money(item.unit_price, order.currency))}</td>
        <td class="num">${escapeHtml(money(item.line_total, order.currency))}</td>
      </tr>`,
    )
    .join('')

  return shell(
    `Invoice — Order ${order.order_number}`,
    `${orderNumberBlock(order, 'Invoice')}
     ${billTo(order)}
     <table>
       <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Line total</th></tr></thead>
       <tbody>${items}</tbody>
     </table>
     ${totalsBlock(order)}
     ${footer(settings)}`,
  )
}

export function packingSlipHtml(order: AdminOrder, settings: StoreSettings | null): string {
  const items = (order.order_items ?? [])
    .map(
      (item) => `<tr>
        <td><span class="slip-check"></span></td>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(
          [item.colour, item.size].filter(Boolean).join(' · '),
        )}</span>${item.sku ? `<br><span class="muted">SKU ${escapeHtml(item.sku)}</span>` : ''}</td>
        <td class="num">${escapeHtml(item.quantity)}</td>
      </tr>`,
    )
    .join('')

  return shell(
    `Packing slip — Order ${order.order_number}`,
    `${orderNumberBlock(order, 'Packing slip')}
     ${billTo(order)}
     <table>
       <thead><tr><th style="width:28px"></th><th>Item</th><th class="num">Qty</th></tr></thead>
       <tbody>${items}</tbody>
     </table>
     ${
       order.customer_notes
         ? `<div style="margin-top:20px"><p class="micro">Customer note</p><p>${escapeHtml(order.customer_notes)}</p></div>`
         : ''
     }
     <div class="footer">${settings ? `${escapeHtml(settings.store_name)} · ` : ''}Packed by ____________________ &nbsp;&nbsp; Checked by ____________________ &nbsp;&nbsp; Date ____________</div>`,
  )
}

export function shippingLabelHtml(
  order: AdminOrder,
  delivery: AdminDelivery | null,
  settings: StoreSettings | null,
): string {
  const sender = settings
    ? `${settings.store_name}\n${settings.address}${settings.phone ? `\n${settings.phone}` : ''}`
    : 'HALA.S CLOTHING'
  return shell(
    `Shipping label — Order ${order.order_number}`,
    `<div style="border:2px solid #16140f; padding:16px">
      <div class="row">
        <div style="flex:1">
          <p class="micro">From</p>
          <p class="address" style="margin:4px 0 0; font-size:11px">${escapeHtml(sender)}</p>
        </div>
        <div style="text-align:right">
          <p class="micro">Cash on Delivery</p>
          <p style="font-size:20px; margin:4px 0 0; font-weight:700">${escapeHtml(money(order.total, order.currency))}</p>
        </div>
      </div>
      <div style="border-top:2px solid #16140f; margin:14px 0; padding-top:14px">
        <p class="micro">Ship to</p>
        <p style="font-size:19px; font-weight:700; margin:6px 0 0">${escapeHtml(order.customer_name)}</p>
        <p class="address" style="font-size:14px; margin:4px 0 0">${escapeHtml(order.address)}
${escapeHtml(order.city)} ${escapeHtml(order.postal_code)}
${escapeHtml(order.country)}</p>
        <p style="font-size:14px; margin:8px 0 0"><strong>Tel:</strong> ${escapeHtml(order.phone)}</p>
      </div>
      <div class="row" style="border-top:1px solid #16140f; padding-top:12px">
        <div><p class="micro">Order</p><p style="font-size:16px; font-weight:700; margin:2px 0 0">#${escapeHtml(order.order_number)}</p></div>
        <div><p class="micro">Courier</p><p style="margin:2px 0 0">${escapeHtml(delivery?.courier_name || '—')}</p></div>
        <div><p class="micro">Tracking</p><p style="margin:2px 0 0">${escapeHtml(delivery?.tracking_number || '—')}</p></div>
        <div><p class="micro">Dispatch</p><p style="margin:2px 0 0">${escapeHtml(
          delivery?.dispatch_date ? dateOnly(delivery.dispatch_date) : '—',
        )}</p></div>
      </div>
      <p class="micro" style="margin-top:14px; text-align:center">Order ${escapeHtml(
        order.order_number,
      )} · Placed ${escapeHtml(dateTime(order.placed_at))}</p>
    </div>`,
    '@page { size: 100mm 150mm; margin: 6mm; }',
  )
}

export function openPrintDocument(title: string, html: string): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const frameWindow = frame.contentWindow
  if (!frameWindow) {
    frame.remove()
    return
  }
  frameWindow.document.open()
  frameWindow.document.write(html)
  frameWindow.document.close()
  frameWindow.document.title = title
  const trigger = () => {
    try {
      frameWindow.focus()
      frameWindow.print()
    } finally {
      window.setTimeout(() => frame.remove(), 60_000)
    }
  }
  if (frameWindow.document.readyState === 'complete') window.setTimeout(trigger, 60)
  else frame.onload = () => window.setTimeout(trigger, 60)
}
