/**
 * HALA.S transactional email worker.
 *
 * Invoked by Supabase Cron (or manually with the worker secret). Claims due
 * rows from public.email_outbox, renders a template, sends through Resend and
 * records the outcome. Secrets stay in the Edge Function environment.
 *
 * Required secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *   EMAIL_WORKER_SECRET, EMAIL_FROM
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { renderEmail, type EmailPayload } from './templates.ts'

interface OutboxRow {
  id: string
  recipient: string
  subject: string
  template: string
  payload: EmailPayload
  attempts: number
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

Deno.serve(async (request) => {
  if (request.method === 'GET') {
    return json({ ok: true, service: 'halas-email-worker' })
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const workerSecret = Deno.env.get('EMAIL_WORKER_SECRET') ?? ''
  const from = Deno.env.get('EMAIL_FROM') ?? ''

  if (!supabaseUrl || !serviceRoleKey || !resendKey || !workerSecret || !from) {
    return json(
      {
        ok: false,
        error:
          'Worker is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_WORKER_SECRET and EMAIL_FROM.',
      },
      500,
    )
  }

  const provided = request.headers.get('x-worker-secret') ?? ''
  if (!timingSafeEqual(provided, workerSecret)) {
    return json({ ok: false, error: 'Unauthorized.' }, 401)
  }

  let limit = 20
  try {
    const body = await request.json()
    if (body && Number.isInteger(body.limit)) {
      limit = Math.max(1, Math.min(Number(body.limit), 100))
    }
  } catch {
    // Empty or non-JSON bodies are fine; use the default batch size.
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: staleError } = await supabase.rpc('email_cancel_stale')
  if (staleError) {
    console.error('Could not release stale emails', staleError.message)
  }

  const { data: claimed, error: claimError } = await supabase.rpc('email_claim_batch', {
    p_limit: limit,
  })
  if (claimError) {
    console.error('Could not claim email batch', claimError.message)
    return json({ ok: false, error: 'Could not claim the email queue.' }, 500)
  }

  const rows = (claimed ?? []) as OutboxRow[]
  let sent = 0
  let failed = 0

  for (const row of rows) {
    try {
      const rendered = renderEmail(row.template, row.payload ?? {})

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `halas-outbox-${row.id}`,
        },
        body: JSON.stringify({
          from,
          to: [row.recipient],
          subject: row.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Resend ${response.status}: ${detail.slice(0, 500)}`)
      }

      const result = (await response.json()) as { id?: string }
      const { error: markError } = await supabase.rpc('email_mark_sent', {
        p_id: row.id,
        p_provider_message_id: result.id ?? '',
      })
      if (markError) {
        console.error('Could not mark email sent', row.id, markError.message)
      }
      sent += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      console.error('Email delivery failed', row.id, row.template, message)
      const retrySeconds = Math.min(3600, 60 * 2 ** Math.max(0, (row.attempts ?? 1) - 1))
      const { error: markError } = await supabase.rpc('email_mark_failed', {
        p_id: row.id,
        p_error: message,
        p_retry_seconds: retrySeconds,
      })
      if (markError) {
        console.error('Could not record email failure', row.id, markError.message)
      }
    }
  }

  return json({ ok: true, claimed: rows.length, sent, failed })
})
