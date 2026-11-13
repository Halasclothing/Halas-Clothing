import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOnEscape } from './hooks'
import { money, number, titleCase } from './format'
import { IconAlert, IconClose, IconRefresh } from './icons'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <span className="admin-spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="admin-state admin-state--error" role="alert">
      <IconAlert />
      <div>
        <h3>Something went wrong</h3>
        <p>{message}</p>
        {onRetry && (
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onRetry}>
            <IconRefresh /> Try again
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="admin-state admin-state--empty">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {action}
      </div>
    </div>
  )
}

export function Notice({
  tone = 'info',
  children,
  onDismiss,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning'
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className={`admin-notice admin-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="admin-notice__close" onClick={onDismiss} aria-label="Dismiss message">
          <IconClose />
        </button>
      )}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="admin-page-head">
      <div>
        {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="admin-page-head__description">{description}</p>}
      </div>
      {actions && <div className="admin-page-head__actions">{actions}</div>}
    </header>
  )
}

export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  flush = false,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={`admin-card ${className}`.trim()}>
      {(title || actions) && (
        <header className="admin-card__head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="admin-card__actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'admin-card__body admin-card__body--flush' : 'admin-card__body'}>{children}</div>
    </section>
  )
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'

const badgeTones: Record<string, BadgeTone> = {
  published: 'success',
  active: 'success',
  paid: 'success',
  delivered: 'success',
  sent: 'success',
  draft: 'neutral',
  pending: 'warning',
  pending_confirmation: 'warning',
  processing: 'info',
  confirmed: 'info',
  packed: 'info',
  shipped: 'info',
  out_for_delivery: 'accent',
  ready_to_dispatch: 'warning',
  new: 'accent',
  archived: 'neutral',
  failed: 'danger',
  failed_delivery: 'danger',
  cancelled: 'danger',
  returned: 'danger',
  refunded: 'neutral',
  sending: 'warning',
  low: 'warning',
  out: 'danger',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const key = String(value ?? '')
  return <Badge tone={badgeTones[key] ?? 'neutral'}>{titleCase(key)}</Badge>
}

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: ReactNode
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`admin-field ${className}`.trim()}>
      <span className="admin-field__label">{label}</span>
      {children}
      {hint && !error && <span className="admin-field__hint">{hint}</span>}
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={`admin-toggle ${disabled ? 'is-disabled' : ''}`.trim()}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="admin-toggle__track" aria-hidden="true">
        <span />
      </span>
      <span className="admin-toggle__text">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useOnEscape(onClose, open)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="admin-modal" role="presentation" onMouseDown={onClose}>
      <div
        className={`admin-modal__panel ${wide ? 'admin-modal__panel--wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="admin-modal__head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="admin-icon-btn" onClick={onClose} aria-label="Close dialog">
            <IconClose />
          </button>
        </header>
        <div className="admin-modal__body">{children}</div>
        {footer && <footer className="admin-modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${tone === 'danger' ? 'admin-btn--danger' : 'admin-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="admin-modal__copy">{body}</p>
    </Modal>
  )
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <div className="kpi__top">
        <span>{label}</span>
        {icon && <span className="kpi__icon">{icon}</span>}
      </div>
      <strong className="kpi__value">{value}</strong>
      {hint && <span className="kpi__hint">{hint}</span>}
    </div>
  )
}

export function Money({ value, currency = 'PKR' }: { value: number | string | null | undefined; currency?: string }) {
  return <>{money(value, currency)}</>
}

export function Count({ value }: { value: number | string | null | undefined }) {
  return <>{number(value)}</>
}

export function RevenueChart({
  series,
  currency = 'PKR',
}: {
  series: { date: string; revenue: number; orders: number }[]
  currency?: string
}) {
  if (!series.length) {
    return <p className="admin-muted">No revenue recorded for this period.</p>
  }
  const max = Math.max(...series.map((point) => Number(point.revenue) || 0), 1)
  const hasSales = series.some((point) => Number(point.revenue) > 0)

  return (
    <div className="revenue-chart">
      <div className="revenue-chart__scale">
        <span>{money(max, currency)}</span>
        <span>{money(0, currency)}</span>
      </div>
      <div className="revenue-chart__plot" role="img" aria-label="Revenue by day">
        {series.map((point) => {
          const height = hasSales ? Math.max(1.5, (Number(point.revenue) / max) * 100) : 0
          return (
            <div className="revenue-chart__col" key={point.date}>
              <div
                className="revenue-chart__bar"
                style={{ height: `${height}%` } as CSSProperties}
                title={`${point.date}: ${money(point.revenue, currency)} · ${point.orders} order(s)`}
              />
            </div>
          )
        })}
      </div>
      <div className="revenue-chart__axis">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  )
}

export function BreakdownBars({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values).filter(([, count]) => count > 0)
  const max = Math.max(...entries.map(([, count]) => count), 1)
  if (!entries.length) return <p className="admin-muted">No orders in this period.</p>
  return (
    <div className="breakdown">
      {entries.map(([status, count]) => (
        <div className="breakdown__row" key={status}>
          <span>{titleCase(status)}</span>
          <div className="breakdown__track">
            <span style={{ width: `${Math.max(3, (count / max) * 100)}%` }} />
          </div>
          <strong>{count}</strong>
        </div>
      ))}
    </div>
  )
}
