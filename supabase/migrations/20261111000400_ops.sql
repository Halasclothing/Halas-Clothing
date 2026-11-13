-- 04 — email outbox, audit trail and operational helpers.

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  audience text not null check (audience in ('admin', 'customer')),
  recipient text not null,
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text not null default '',
  provider_message_id text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  dedupe_key text not null,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists email_outbox_dedupe_key on public.email_outbox (dedupe_key);
create index if not exists email_outbox_due_idx on public.email_outbox (status, next_attempt_at);
create index if not exists email_outbox_order_idx on public.email_outbox (order_id, created_at desc);
create index if not exists email_outbox_created_idx on public.email_outbox (created_at desc);

alter table public.email_outbox enable row level security;

drop trigger if exists email_outbox_touch on public.email_outbox;
create trigger email_outbox_touch before update on public.email_outbox
for each row execute function public.touch_updated_at();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text not null default '',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

alter table public.activity_logs enable row level security;

-- Every admin mutation funnels through this helper so the audit trail cannot be
-- forgotten by an individual RPC.
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  insert into public.activity_logs (actor_id, actor_email, action, entity_type, entity_id, details)
  values (auth.uid(), v_email, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.enqueue_email(
  p_event_type text,
  p_audience text,
  p_recipient text,
  p_template text,
  p_subject text,
  p_payload jsonb,
  p_order_id uuid,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enabled boolean;
  v_recipient text := btrim(coalesce(p_recipient, ''));
begin
  select np.enabled into v_enabled
    from public.notification_preferences np
   where np.event_type = p_event_type
     and np.audience = p_audience;

  if v_enabled is distinct from true then
    return;
  end if;

  if p_audience = 'admin' then
    select nullif(btrim(ss.admin_notification_email), '') into v_recipient
      from public.store_settings ss
     where ss.id = 1;
  end if;

  if v_recipient is null or v_recipient = '' then
    return;
  end if;

  insert into public.email_outbox (
    event_type, audience, recipient, template, subject, payload, order_id, dedupe_key
  ) values (
    p_event_type, p_audience, v_recipient, p_template, p_subject,
    coalesce(p_payload, '{}'::jsonb), p_order_id, p_dedupe_key
  )
  on conflict (dedupe_key) do nothing;
end;
$$;
