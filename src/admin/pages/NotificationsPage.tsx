import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  getStoreSettings,
  listEmailLog,
  listNotificationPreferences,
  retryEmail,
  sendTestEmail,
  setNotificationPreference,
  type AdminEmailLog,
  type NotificationPreference,
} from '../api'
import { dateTime, number, titleCase } from '../format'
import { useAsync } from '../hooks'
import { IconAlert, IconMail, IconRefresh } from '../icons'
import {
  Card,
  ErrorState,
  Field,
  KpiCard,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
  Toggle,
} from '../ui'

export function NotificationsPage() {
  useDocumentTitle('Notifications — HALA.S Admin')
  const { data, loading, error, reload } = useAsync(async () => {
    const [log, preferences, settings] = await Promise.all([
      listEmailLog(200),
      listNotificationPreferences(),
      getStoreSettings(),
    ])
    return { log, preferences, settings }
  }, [])

  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [recipient, setRecipient] = useState('')

  const log = data?.log ?? []
  const preferences = data?.preferences ?? []

  const health = useMemo(() => {
    const counts = { sent: 0, failed: 0, pending: 0 }
    for (const entry of log) {
      if (entry.status === 'sent') counts.sent += 1
      else if (entry.status === 'failed') counts.failed += 1
      else if (entry.status === 'pending' || entry.status === 'sending') counts.pending += 1
    }
    return counts
  }, [log])

  const grouped = useMemo(
    () => ({
      admin: preferences.filter((preference) => preference.audience === 'admin'),
      customer: preferences.filter((preference) => preference.audience === 'customer'),
    }),
    [preferences],
  )

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key)
    setNotice(null)
    setProblem(null)
    try {
      await action()
      setNotice(message)
      await reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The action could not be completed.')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (preference: NotificationPreference, enabled: boolean) =>
    run(
      `pref:${preference.event_type}`,
      () => setNotificationPreference(preference.event_type, enabled),
      `${preference.label} notifications ${enabled ? 'enabled' : 'disabled'}.`,
    )

  const sendTest = () => {
    const target = recipient.trim()
    void run(
      'test',
      () => sendTestEmail(target),
      target ? `Test email queued to ${target}.` : 'Test email queued to the notification address.',
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Notifications"
        description="Transactional email is queued in the database and delivered by the send-emails function with retries. Provider credentials live only in the function environment."
        actions={
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={reload} disabled={loading}>
            <IconRefresh /> Refresh
          </button>
        }
      />

      {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {problem && <Notice tone="error" onDismiss={() => setProblem(null)}>{problem}</Notice>}

      {loading && !data && <Spinner label="Loading notification log" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="kpi-grid kpi-grid--compact">
            <KpiCard label="Delivery address" value={data.settings.admin_notification_email || 'Not set'} hint="Change in Settings" />
            <KpiCard label="Sent" value={number(health.sent)} hint="Recorded in the outbox" />
            <KpiCard
              label="Failed"
              value={number(health.failed)}
              hint="Retry from the log below"
              tone={health.failed ? 'danger' : 'neutral'}
            />
            <KpiCard label="Waiting" value={number(health.pending)} hint="Queued or sending" tone={health.pending ? 'warning' : 'neutral'} />
          </div>

          <div className="admin-grid admin-grid--2">
            <Card
              title="Send a test email"
              description="Verifies the Resend key, sender domain and delivery address end to end."
            >
              <div className="admin-form-grid">
                <Field label="Recipient" hint="Leave blank to use the admin notification address.">
                  <input
                    className="admin-input"
                    type="email"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder={data.settings.admin_notification_email || 'admin@example.com'}
                  />
                </Field>
              </div>
              <div className="admin-form-actions">
                <button className="admin-btn admin-btn--primary" type="button" onClick={sendTest} disabled={busy === 'test'}>
                  <IconMail /> {busy === 'test' ? 'Queuing…' : 'Queue test email'}
                </button>
              </div>
              <p className="admin-field__hint">
                Resend credentials are configured as Edge Function secrets — never in this browser bundle. The cron worker
                picks up queued mail within a minute.
              </p>
            </Card>

            <Card title="Delivery health" description="Based on the 200 most recent outbox entries.">
              <dl className="admin-facts">
                <div>
                  <dt>Total logged</dt>
                  <dd>{number(log.length)}</dd>
                </div>
                <div>
                  <dt>Failed attempts to review</dt>
                  <dd>
                    {health.failed > 0 ? (
                      <span className="admin-inline-alert">
                        <IconAlert /> {number(health.failed)} failed
                      </span>
                    ) : (
                      'None'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Notification address</dt>
                  <dd>{data.settings.admin_notification_email || 'Not configured'}</dd>
                </div>
              </dl>
              <p className="admin-field__hint">
                Order confirmations, shipment tracking and delivery notices are sent to customers automatically. Marketing
                email is only sent where the customer has opted in.
              </p>
            </Card>
          </div>

          <div className="admin-grid admin-grid--2">
            <Card title="Admin alerts" description="Email sent to the store team.">
              {grouped.admin.length === 0 ? (
                <p className="admin-muted">No admin notification types are configured.</p>
              ) : (
                <div className="admin-toggle-list">
                  {grouped.admin.map((preference) => (
                    <Toggle
                      key={preference.event_type}
                      checked={preference.enabled}
                      disabled={busy === `pref:${preference.event_type}`}
                      onChange={(enabled) => toggle(preference, enabled)}
                      label={preference.label}
                      description={titleCase(preference.event_type)}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Customer email" description="Transactional messages triggered by order events.">
              {grouped.customer.length === 0 ? (
                <p className="admin-muted">No customer notification types are configured.</p>
              ) : (
                <div className="admin-toggle-list">
                  {grouped.customer.map((preference) => (
                    <Toggle
                      key={preference.event_type}
                      checked={preference.enabled}
                      disabled={busy === `pref:${preference.event_type}`}
                      onChange={(enabled) => toggle(preference, enabled)}
                      label={preference.label}
                      description={`${titleCase(preference.event_type)} · transactional only`}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card
            title="Email log"
            description="Every queued message with attempt count and provider error. Retry failed delivery here."
            actions={
              <Link className="admin-link" to="/admin/settings">
                Notification settings
              </Link>
            }
            flush
          >
            {log.length === 0 ? (
              <p className="admin-empty-copy">No email has been queued yet. Place a test order to exercise the pipeline.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Queued</th>
                      <th>Event</th>
                      <th>Audience</th>
                      <th>Recipient</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th className="is-right">Attempts</th>
                      <th>Last error</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((entry: AdminEmailLog) => (
                      <tr key={entry.id}>
                        <td>{dateTime(entry.created_at)}</td>
                        <td>
                          {titleCase(entry.event_type)}
                          {entry.order_id && (
                            <small className="admin-cell-sub">
                              <Link className="admin-link" to={`/admin/orders/${entry.order_id}`}>
                                View order
                              </Link>
                            </small>
                          )}
                        </td>
                        <td>{titleCase(entry.audience)}</td>
                        <td className="admin-cell-wrap">{entry.recipient || '—'}</td>
                        <td className="admin-cell-wrap">{entry.subject || '—'}</td>
                        <td>
                          <StatusBadge value={entry.status === 'sending' ? 'pending' : entry.status} />
                        </td>
                        <td className="is-right">{number(entry.attempts)}</td>
                        <td className="admin-cell-wrap admin-cell-sub">{entry.last_error || '—'}</td>
                        <td className="is-right">
                          {entry.status === 'failed' && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost admin-btn--tiny"
                              disabled={busy === `retry:${entry.id}`}
                              onClick={() =>
                                run(`retry:${entry.id}`, () => retryEmail(entry.id), 'Email re-queued for delivery.')
                              }
                            >
                              {busy === `retry:${entry.id}` ? 'Retrying…' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
