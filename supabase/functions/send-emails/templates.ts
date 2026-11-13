/**
 * Pure email renderers shared by the Supabase Edge Function and the local
 * template tests. No network or runtime-specific APIs live here.
 */

export type EmailPayload = Record<string, unknown>

export interface RenderedEmail {
  html: string
  text: string
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const money = (value: unknown, currency = 'PKR'): string => {
  const amount = Number(value ?? 0)
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
  return `${currency} ${formatted}`
}

const dateTime = (value: unknown): string => {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const dateOnly = (value: unknown): string => {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

const label = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

interface Item {
  title?: string
  variant?: string
  size?: string
  colour?: string
  sku?: string
  quantity?: number
  unit_price?: number
  line_total?: number
}

const itemsOf = (payload: EmailPayload): Item[] =>
  Array.isArray(payload.items) ? (payload.items as Item[]) : []

const itemsTable = (payload: EmailPayload, currency: string): string => {
  const items = itemsOf(payload)
  if (items.length === 0) return ''
  const rows = items
    .map((item) => {
      const options = [item.size, item.colour].filter(Boolean).join(' / ')
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e7e1d6;font-size:14px;color:#1a1815;">
          <strong>${escapeHtml(item.title)}</strong>
          ${options ? `<br><span style="color:#6f675d;font-size:12px;">${escapeHtml(options)}</span>` : ''}
          ${item.sku ? `<br><span style="color:#8c8478;font-size:11px;">SKU ${escapeHtml(item.sku)}</span>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e7e1d6;text-align:center;font-size:14px;color:#1a1815;">${escapeHtml(item.quantity)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e7e1d6;text-align:right;font-size:14px;color:#1a1815;">${escapeHtml(money(item.line_total, currency))}</td>
      </tr>`
    })
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
    <thead>
      <tr>
        <th align="left" style="padding:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8c8478;font-weight:600;">Item</th>
        <th align="center" style="padding:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8c8478;font-weight:600;">Qty</th>
        <th align="right" style="padding:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8c8478;font-weight:600;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

const totals = (payload: EmailPayload, currency: string): string => {
  const line = (name: string, value: unknown, strong = false) =>
    `<tr>
      <td style="padding:4px 0;font-size:${strong ? '15px' : '13px'};color:${strong ? '#1a1815' : '#6f675d'};${strong ? 'font-weight:600;' : ''}">${escapeHtml(name)}</td>
      <td align="right" style="padding:4px 0;font-size:${strong ? '15px' : '13px'};color:#1a1815;${strong ? 'font-weight:600;' : ''}">${escapeHtml(money(value, currency))}</td>
    </tr>`
  const rows = [
    line('Subtotal', payload.subtotal),
    Number(payload.shipping_fee) > 0 ? line('Shipping', payload.shipping_fee) : line('Shipping', 0),
    Number(payload.tax_total) > 0 ? line('Tax included', payload.tax_total) : '',
    line('Total', payload.total, true),
  ].join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>`
}

const addressBlock = (payload: EmailPayload): string => `
  <div style="margin-top:18px;padding:16px;background:#f7f4ee;border:1px solid #e7e1d6;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8c8478;">Delivery address</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#1a1815;">
      ${escapeHtml(payload.customer_name)}<br>
      ${escapeHtml(payload.address)}<br>
      ${escapeHtml(payload.city)}${payload.postal_code ? `, ${escapeHtml(payload.postal_code)}` : ''}<br>
      ${escapeHtml(payload.country)}<br>
      ${escapeHtml(payload.phone)}
    </p>
  </div>`

const button = (href: unknown, text: string, background = '#1a1815'): string => {
  if (!href) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
    <tr><td style="background:${background};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(text)}</a>
    </td></tr>
  </table>`
}

const shell = (options: {
  storeName: string
  heading: string
  preheader: string
  body: string
  footerNote?: string
  supportEmail?: string
}): string => `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#efe9dc;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe9dc;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf8;border:1px solid #e2dacb;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e7e1d6;text-align:center;">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:0.22em;color:#1a1815;">${escapeHtml(options.storeName)}</p>
        </td></tr>
        <tr><td style="padding:30px 28px 10px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:400;color:#1a1815;">${escapeHtml(options.heading)}</h1>
          ${options.body}
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          ${options.footerNote ? `<p style="margin:18px 0 0;padding-top:18px;border-top:1px solid #e7e1d6;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#8c8478;">${escapeHtml(options.footerNote)}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#a39a8c;">
            ${escapeHtml(options.storeName)}${options.supportEmail ? ` · ${escapeHtml(options.supportEmail)}` : ''}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const orderSummary = (payload: EmailPayload): string => {
  const currency = String(payload.currency ?? 'PKR')
  return `<div style="font-family:Arial,sans-serif;color:#1a1815;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8c8478;">Order #${escapeHtml(payload.order_number)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#6f675d;">Placed ${escapeHtml(dateTime(payload.placed_at))} · ${escapeHtml(label(payload.payment_method))} · ${escapeHtml(label(payload.order_status))}</p>
    ${itemsTable(payload, currency)}
    ${totals(payload, currency)}
    ${addressBlock(payload)}
  </div>`
}

const adminShell = (payload: EmailPayload, heading: string, intro: string, body: string): RenderedEmail => {
  const storeName = String(payload.store_name ?? 'HALA.S CLOTHING')
  const bodyHtml = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">${escapeHtml(intro)}</p>
    ${body}
    ${button(payload.admin_url, 'Open in admin', '#1a1815')}
  </div>`
  return {
    html: shell({
      storeName,
      heading,
      preheader: heading,
      body: bodyHtml,
      footerNote: 'Operational notification from the HALA.S admin portal.',
      supportEmail: String(payload.support_email ?? ''),
    }),
    text: `${heading}\n\n${intro}\n\n${bodyText(payload)}\n\nAdmin: ${payload.admin_url ?? ''}`,
  }
}

const bodyText = (payload: EmailPayload): string => {
  const items = itemsOf(payload)
    .map((item) => `- ${item.title}${item.size ? ` / ${item.size}` : ''}${item.colour ? ` / ${item.colour}` : ''} x${item.quantity} — ${money(item.line_total, String(payload.currency ?? 'PKR'))}`)
    .join('\n')
  return [
    `Order #${payload.order_number}`,
    `Customer: ${payload.customer_name} (${payload.phone})`,
    `Email: ${payload.email ?? '—'}`,
    `Address: ${payload.address}, ${payload.city} ${payload.postal_code ?? ''}, ${payload.country}`,
    '',
    items,
    '',
    `Subtotal: ${money(payload.subtotal, String(payload.currency ?? 'PKR'))}`,
    `Shipping: ${money(payload.shipping_fee, String(payload.currency ?? 'PKR'))}`,
    `Total: ${money(payload.total, String(payload.currency ?? 'PKR'))}`,
    `Payment: ${label(payload.payment_method)} (${label(payload.payment_status)})`,
    `Status: ${label(payload.order_status)}`,
    payload.courier_name ? `Courier: ${payload.courier_name}` : '',
    payload.tracking_number ? `Tracking: ${payload.tracking_number}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const renderEmail = (template: string, payload: EmailPayload): RenderedEmail => {
  const storeName = String(payload.store_name ?? 'HALA.S CLOTHING')
  const orderNumber = String(payload.order_number ?? '')
  const currency = String(payload.currency ?? 'PKR')

  switch (template) {
    case 'admin_new_order': {
      const body = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;background:#f7f4ee;border:1px solid #e7e1d6;">
          <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#1a1815;">
            <strong>${escapeHtml(payload.customer_name)}</strong><br>
            <a href="tel:${escapeHtml(payload.phone)}" style="color:#1a1815;">${escapeHtml(payload.phone)}</a><br>
            ${escapeHtml(payload.email ?? '')}
          </td></tr>
        </table>
        ${orderSummary(payload)}
        ${payload.customer_notes ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#6f675d;">Customer note: ${escapeHtml(payload.customer_notes)}</p>` : ''}
        ${button(payload.admin_url, 'Open order')}
      </div>`
      return {
        html: shell({
          storeName,
          heading: `New order #${orderNumber}`,
          preheader: `${payload.customer_name} placed order #${orderNumber} for ${money(payload.total, currency)}`,
          body,
          footerNote: 'Cash on Delivery order received from the storefront.',
          supportEmail: String(payload.support_email ?? ''),
        }),
        text: `New order #${orderNumber}\n\n${bodyText(payload)}\n\nAdmin: ${payload.admin_url ?? ''}`,
      }
    }

    case 'customer_order_confirmation': {
      const body = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">Thank you, ${escapeHtml(payload.customer_name)}. We have received your order and will confirm it shortly. Payment is Cash on Delivery.</p>
        ${orderSummary(payload)}
        ${payload.customer_notes ? `<p style="margin:16px 0 0;font-size:13px;color:#6f675d;">Your note: ${escapeHtml(payload.customer_notes)}</p>` : ''}
      </div>`
      return {
        html: shell({
          storeName,
          heading: `Order #${orderNumber} received`,
          preheader: `We received your HALA.S order #${orderNumber}.`,
          body,
          footerNote: 'You will receive another email when your order is confirmed and dispatched.',
          supportEmail: String(payload.support_email ?? ''),
        }),
        text: `Order #${orderNumber} received\n\nThank you, ${payload.customer_name}. Payment is Cash on Delivery.\n\n${bodyText(payload)}`,
      }
    }

    case 'customer_order_status': {
      const body = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">Your order #${escapeHtml(orderNumber)} is now <strong>${escapeHtml(label(payload.order_status))}</strong>.</p>
        ${orderSummary(payload)}
      </div>`
      return {
        html: shell({
          storeName,
          heading: `Order #${orderNumber} update`,
          preheader: `Your order is now ${label(payload.order_status)}.`,
          body,
          supportEmail: String(payload.support_email ?? ''),
        }),
        text: `Order #${orderNumber} is now ${label(payload.order_status)}.\n\n${bodyText(payload)}`,
      }
    }

    case 'customer_shipment_notification': {
      const tracking = payload.tracking_number
        ? `<div style="margin:18px 0;padding:16px;border:1px solid #e7e1d6;">
             <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8c8478;">Tracking</p>
             <p style="margin:0;font-size:14px;color:#1a1815;">${escapeHtml(payload.courier_name || 'Courier')} · ${escapeHtml(payload.tracking_number)}</p>
             ${payload.tracking_url ? `<p style="margin:6px 0 0;font-size:13px;"><a href="${escapeHtml(payload.tracking_url)}" style="color:#1a1815;">Track your parcel</a></p>` : ''}
             ${payload.expected_delivery_date ? `<p style="margin:6px 0 0;font-size:13px;color:#6f675d;">Expected ${escapeHtml(dateOnly(payload.expected_delivery_date))}</p>` : ''}
           </div>`
        : `<p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">Tracking details will follow as soon as the courier scans your parcel.</p>`
      const body = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">Your order #${escapeHtml(orderNumber)} has been dispatched.</p>
        ${tracking}
        ${orderSummary(payload)}
      </div>`
      return {
        html: shell({
          storeName,
          heading: `Order #${orderNumber} is on its way`,
          preheader: `Your order #${orderNumber} has been dispatched.`,
          body,
          supportEmail: String(payload.support_email ?? ''),
        }),
        text: `Order #${orderNumber} is on its way.\n\n${bodyText(payload)}`,
      }
    }

    case 'customer_delivery_confirmation': {
      const body = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">Your order #${escapeHtml(orderNumber)} has been delivered. We hope it fits well.</p>
        ${orderSummary(payload)}
      </div>`
      return {
        html: shell({
          storeName,
          heading: `Order #${orderNumber} delivered`,
          preheader: `Your HALA.S order has been delivered.`,
          body,
          supportEmail: String(payload.support_email ?? ''),
        }),
        text: `Order #${orderNumber} delivered.\n\n${bodyText(payload)}`,
      }
    }

    case 'admin_order_cancelled':
      return adminShell(payload, `Order #${orderNumber} cancelled`,
        `${payload.customer_name} — ${money(payload.total, currency)}. The order was cancelled and stock handling has been applied.`,
        orderSummary(payload))

    case 'admin_order_returned':
      return adminShell(payload, `Order #${orderNumber} returned`,
        `${payload.customer_name} — ${money(payload.total, currency)}. The parcel has been marked returned.`,
        orderSummary(payload))

    case 'admin_delivery_failed':
      return adminShell(payload, `Delivery failed for #${orderNumber}`,
        `${payload.customer_name} — ${payload.city}. Courier: ${payload.courier_name || 'not set'}${payload.tracking_number ? ` (${payload.tracking_number})` : ''}.`,
        `${orderSummary(payload)}${payload.delivery_notes ? `<p style="font-size:13px;color:#6f675d;">Delivery note: ${escapeHtml(payload.delivery_notes)}</p>` : ''}`)

    case 'admin_payment_status':
      return adminShell(payload, `Payment ${label(payload.payment_status)} for #${orderNumber}`,
        `${payload.customer_name} — ${money(payload.total, currency)}.`,
        orderSummary(payload))

    case 'admin_low_stock':
      return adminShell(payload, `Low stock: ${payload.product_title ?? ''}`,
        `${payload.variant_label ?? ''} has ${payload.available ?? 0} available (threshold ${payload.threshold ?? 0}).`,
        `<p style="margin:0 0 12px;font-size:14px;color:#1a1815;">SKU ${escapeHtml(payload.sku || '—')}</p>${button(payload.product_url, 'Open product')}`)

    case 'admin_out_of_stock':
      return adminShell(payload, `Out of stock: ${payload.product_title ?? ''}`,
        `${payload.variant_label ?? ''} is now out of stock.`,
        `<p style="margin:0 0 12px;font-size:14px;color:#1a1815;">SKU ${escapeHtml(payload.sku || '—')}</p>${button(payload.product_url, 'Open product')}`)

    case 'test_email':
    case 'system_error':
    case 'admin_system_error': {
      const isTest = template === 'test_email'
      return adminShell(
        payload,
        isTest ? 'Test email' : 'System error',
        isTest
          ? 'This is a test notification from your HALA.S admin portal. Email delivery is working.'
          : String(payload.message ?? 'An important system error occurred.'),
        isTest
          ? ''
          : `<pre style="white-space:pre-wrap;background:#f7f4ee;border:1px solid #e7e1d6;padding:14px;font-size:12px;color:#1a1815;">${escapeHtml(JSON.stringify(payload.context ?? {}, null, 2))}</pre>`,
      )
    }

    default: {
      const body = `<div style="font-family:Arial,sans-serif;color:#1a1815;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#40403c;">${escapeHtml(payload.message ?? 'You have a new notification from the HALA.S admin portal.')}</p>
        ${orderNumber ? orderSummary(payload) : ''}
      </div>`
      return {
        html: shell({
          storeName,
          heading: String(payload.heading ?? 'HALA.S notification'),
          preheader: String(payload.message ?? 'New notification'),
          body,
          supportEmail: String(payload.support_email ?? ''),
        }),
        text: `${payload.heading ?? 'HALA.S notification'}\n\n${String(payload.message ?? '')}\n\n${orderNumber ? bodyText(payload) : ''}`,
      }
    }
  }
}
