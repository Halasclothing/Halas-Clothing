import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { getStoreSettings, updateStoreSettings, type StoreSettings } from '../api'
import { useAsync } from '../hooks'
import { Card, ErrorState, Field, Notice, PageHeader, Spinner, Toggle } from '../ui'
import { IconMail, IconRefresh } from '../icons'

type NumericKey = 'shipping_fee' | 'free_shipping_threshold' | 'tax_rate' | 'low_stock_threshold'

interface SettingsDraft {
  store_name: string
  brand_mark: string
  support_email: string
  admin_notification_email: string
  phone: string
  whatsapp: string
  address: string
  currency: string
  cod_enabled: boolean
  shipping_fee: string
  free_shipping_threshold: string
  tax_rate: string
  prices_include_tax: boolean
  low_stock_threshold: string
  restock_cancelled: boolean
  restock_returned: boolean
  timezone: string
  store_url: string
  seo_title: string
  seo_description: string
}

const toDraft = (settings: StoreSettings): SettingsDraft => ({
  store_name: settings.store_name,
  brand_mark: settings.brand_mark,
  support_email: settings.support_email,
  admin_notification_email: settings.admin_notification_email,
  phone: settings.phone,
  whatsapp: settings.whatsapp,
  address: settings.address,
  currency: settings.currency,
  cod_enabled: settings.cod_enabled,
  shipping_fee: String(settings.shipping_fee ?? 0),
  free_shipping_threshold: String(settings.free_shipping_threshold ?? 0),
  tax_rate: String(settings.tax_rate ?? 0),
  prices_include_tax: settings.prices_include_tax,
  low_stock_threshold: String(settings.low_stock_threshold ?? 0),
  restock_cancelled: settings.restock_cancelled,
  restock_returned: settings.restock_returned,
  timezone: settings.timezone,
  store_url: settings.store_url,
  seo_title: settings.seo_title,
  seo_description: settings.seo_description,
})

const numeric = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function SettingsPage() {
  useDocumentTitle('Settings — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(getStoreSettings, [])

  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (data) setDraft(toDraft(data))
  }, [data])

  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current))

  const setNumber = (key: NumericKey, value: string) => set(key, value)

  const save = async () => {
    if (!draft) return
    const numbers = {
      shipping_fee: numeric(draft.shipping_fee),
      free_shipping_threshold: numeric(draft.free_shipping_threshold),
      tax_rate: numeric(draft.tax_rate),
      low_stock_threshold: numeric(draft.low_stock_threshold),
    }
    if (Object.values(numbers).some((value) => Number.isNaN(value))) {
      setProblem('Shipping, tax and stock values must be numbers.')
      return
    }
    if (numbers.shipping_fee < 0 || numbers.free_shipping_threshold < 0) {
      setProblem('Shipping amounts cannot be negative.')
      return
    }
    if (numbers.tax_rate < 0 || numbers.tax_rate > 100) {
      setProblem('Tax rate must be between 0 and 100.')
      return
    }
    if (numbers.low_stock_threshold < 0 || !Number.isInteger(numbers.low_stock_threshold)) {
      setProblem('The low-stock threshold must be a whole number of zero or more.')
      return
    }
    if (draft.admin_notification_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.admin_notification_email)) {
      setProblem('Enter a valid administrator notification email.')
      return
    }

    setBusy(true)
    setNotice(null)
    setProblem(null)
    try {
      await updateStoreSettings({
        ...draft,
        ...numbers,
        low_stock_threshold: Math.round(numbers.low_stock_threshold),
        whatsapp: draft.whatsapp.replace(/[^\d]/g, ''),
      })
      setNotice('Store settings saved. The storefront and order pricing functions pick these up immediately.')
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'Settings could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !draft) return <Spinner label="Loading settings" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!draft) return <ErrorState message="Store settings are unavailable." onRetry={reload} />

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Store identity, pricing, delivery and stock policy. Changes are written through a security-definer function and audited."
        actions={
          <>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={reload} disabled={busy}>
              <IconRefresh /> Reload
            </button>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </>
        }
      />

      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem}</Notice>}

      <div className="admin-grid admin-grid--2">
        <Card title="Store identity" description="Shown on the storefront, invoices and email.">
          <div className="admin-form-grid">
            <Field label="Store name">
              <input className="admin-input" value={draft.store_name} onChange={(event) => set('store_name', event.target.value)} />
            </Field>
            <Field label="Brand mark" hint="Short wordmark used in the storefront header.">
              <input className="admin-input" value={draft.brand_mark} onChange={(event) => set('brand_mark', event.target.value)} />
            </Field>
            <Field label="Support email" hint="Shown to customers in transactional emails.">
              <input
                className="admin-input"
                type="email"
                value={draft.support_email}
                onChange={(event) => set('support_email', event.target.value)}
              />
            </Field>
            <Field
              label="Admin notification email"
              hint="Receives new-order and stock alerts. Leave blank to disable admin email."
            >
              <input
                className="admin-input"
                type="email"
                value={draft.admin_notification_email}
                onChange={(event) => set('admin_notification_email', event.target.value)}
              />
            </Field>
            <Field label="Public store URL" hint="Used for absolute links in email.">
              <input
                className="admin-input"
                type="url"
                value={draft.store_url}
                onChange={(event) => set('store_url', event.target.value)}
                placeholder="https://halas.example"
              />
            </Field>
            <Field label="Timezone" hint="IANA name, e.g. Asia/Karachi. Used for reporting day boundaries.">
              <input className="admin-input" value={draft.timezone} onChange={(event) => set('timezone', event.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Contact" description="Displayed on the contact page and shared documents.">
          <div className="admin-form-grid">
            <Field label="Phone">
              <input className="admin-input" value={draft.phone} onChange={(event) => set('phone', event.target.value)} />
            </Field>
            <Field label="WhatsApp number" hint="Digits only. Used by the storefront WhatsApp link.">
              <input className="admin-input" value={draft.whatsapp} onChange={(event) => set('whatsapp', event.target.value)} />
            </Field>
            <Field label="Address">
              <textarea
                className="admin-input admin-textarea"
                rows={3}
                value={draft.address}
                onChange={(event) => set('address', event.target.value)}
              />
            </Field>
            <Field label="SEO title" hint="Default title for pages without their own.">
              <input className="admin-input" value={draft.seo_title} onChange={(event) => set('seo_title', event.target.value)} />
            </Field>
            <Field label="SEO description">
              <textarea
                className="admin-input admin-textarea"
                rows={3}
                value={draft.seo_description}
                onChange={(event) => set('seo_description', event.target.value)}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="admin-grid admin-grid--2">
        <Card title="Pricing & tax" description="Prices are validated again on the server at checkout.">
          <div className="admin-form-grid">
            <Field label="Currency" hint="Order totals are stored numerically; the storefront currently renders PKR.">
              <select className="admin-input" value={draft.currency} onChange={(event) => set('currency', event.target.value)}>
                {['PKR', 'USD', 'GBP', 'AED', 'EUR', 'SAR'].map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tax rate (%)" hint="Applied to the subtotal by the checkout function.">
              <input
                className="admin-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={draft.tax_rate}
                onChange={(event) => setNumber('tax_rate', event.target.value)}
              />
            </Field>
          </div>
          <div className="admin-toggle-list">
            <Toggle
              checked={draft.prices_include_tax}
              onChange={(value) => set('prices_include_tax', value)}
              label="Prices include tax"
              description="When on, listed prices are tax-inclusive and tax is extracted from the subtotal."
            />
          </div>
        </Card>

        <Card title="Shipping & Cash on Delivery" description="Used by the storefront and order function.">
          <div className="admin-form-grid">
            <Field label="Standard shipping fee">
              <input
                className="admin-input"
                type="number"
                min="0"
                step="1"
                value={draft.shipping_fee}
                onChange={(event) => setNumber('shipping_fee', event.target.value)}
              />
            </Field>
            <Field label="Free shipping over" hint="Set to 0 to disable the free-shipping threshold.">
              <input
                className="admin-input"
                type="number"
                min="0"
                step="1"
                value={draft.free_shipping_threshold}
                onChange={(event) => setNumber('free_shipping_threshold', event.target.value)}
              />
            </Field>
          </div>
          <div className="admin-toggle-list">
            <Toggle
              checked={draft.cod_enabled}
              onChange={(value) => set('cod_enabled', value)}
              label="Cash on Delivery"
              description="When off, the checkout function rejects COD orders."
            />
          </div>
        </Card>
      </div>

      <div className="admin-grid admin-grid--2">
        <Card title="Stock policy" description="Applied automatically by order transitions.">
          <div className="admin-form-grid">
            <Field label="Low stock threshold" hint="New variants default to this level; used for alerts and reporting.">
              <input
                className="admin-input"
                type="number"
                min="0"
                step="1"
                value={draft.low_stock_threshold}
                onChange={(event) => setNumber('low_stock_threshold', event.target.value)}
              />
            </Field>
          </div>
          <div className="admin-toggle-list">
            <Toggle
              checked={draft.restock_cancelled}
              onChange={(value) => set('restock_cancelled', value)}
              label="Restore stock on cancellation"
              description="Returns reserved or deducted units to available stock exactly once."
            />
            <Toggle
              checked={draft.restock_returned}
              onChange={(value) => set('restock_returned', value)}
              label="Restore stock on return"
              description="Returned orders add their units back to available stock."
            />
          </div>
        </Card>

        <Card title="Email delivery" description="Templates are sent by the send-emails Edge Function.">
          <dl className="admin-facts">
            <div>
              <dt>Notification address</dt>
              <dd>{draft.admin_notification_email || 'Not configured'}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>Resend — API key stored only as an Edge Function secret</dd>
            </div>
            <div>
              <dt>Retries</dt>
              <dd>Automatic backoff; failed messages can be retried manually</dd>
            </div>
          </dl>
          <div className="admin-form-actions">
            <Link className="admin-btn admin-btn--ghost" to="/admin/notifications">
              <IconMail /> Open notification log
            </Link>
          </div>
        </Card>
      </div>

      <div className="admin-form-actions admin-form-actions--end">
        <button type="button" className="admin-btn admin-btn--primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </>
  )
}
