export const currencyFormatter = (currency = 'PKR') =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 })

export const money = (value: number | string | null | undefined, currency = 'PKR') =>
  currencyFormatter(currency).format(Number(value ?? 0))

export const number = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-PK').format(Number(value ?? 0))

export const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export const dateOnly = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const isoDay = (value: Date) => {
  const copy = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return copy.toISOString().slice(0, 10)
}

export const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

export const titleCase = (value: string | null | undefined) =>
  String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const csvCell = (value: unknown) => {
  const raw = value == null ? '' : String(value)
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

export const summariseItems = (items: { title: string; quantity: number }[] | null | undefined) =>
  (items ?? []).reduce((total, item) => total + Number(item.quantity || 0), 0)
