-- HALA.S — schedule the transactional email worker with pg_cron + pg_net.
--
-- Run AFTER:
--   1. supabase/setup.sql
--   2. supabase/functions/send-emails is deployed with:
--        supabase functions deploy send-emails --no-verify-jwt
--      and these Edge Function secrets are set:
--        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
--        EMAIL_WORKER_SECRET, EMAIL_FROM
--
-- This file calls the function every minute. It keeps the shared worker
-- secret in Supabase Vault instead of hard-coding it in the job definition.
--
-- ⚠ Do not commit real secret values. Run the two Vault statements once in
--   the SQL editor (or add the secrets in Dashboard → Vault), then run the
--   cron statement and delete the values from your editor history.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 1) Vault secrets (replace both placeholder values before running).
select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'halas_project_url', 'HALA.S project URL');
select vault.create_secret('REPLACE-WITH-THE-SAME-RANDOM-EMAIL_WORKER_SECRET', 'halas_email_worker_secret', 'Cron → email worker shared secret');

-- 2) Invoke the worker once a minute.
do $$
begin
  perform cron.unschedule('halas-email-worker');
exception
  when others then null;  -- job did not exist yet
end;
$$;

select cron.schedule(
  'halas-email-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'halas_project_url')
           || '/functions/v1/send-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'halas_email_worker_secret')
    ),
    body := '{"limit": 20}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Verify the job exists:
select jobid, jobname, schedule, active from cron.job where jobname = 'halas-email-worker';

-- Inspect recent HTTP calls (pg_net keeps them briefly):
-- select id, status_code, timed_out, content
--   from net._http_response
--  order by id desc
--  limit 5;

-- Pause / remove the schedule:
-- select cron.unschedule('halas-email-worker');
