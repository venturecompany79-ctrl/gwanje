-- =============================================================
-- 모바일 앱: Expo push token registry / delivery history
-- =============================================================

create table if not exists mobile_device (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  user_id         uuid not null references profile (id) on delete cascade,
  expo_push_token text not null,
  platform        text not null default 'unknown'
    check (platform in ('ios', 'android', 'web', 'unknown')),
  device_name     text,
  app_version     text,
  last_seen_at    timestamptz not null default now(),
  disabled_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create table if not exists mobile_push_delivery (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  notification_id uuid not null references notification (id) on delete cascade,
  device_id       uuid not null references mobile_device (id) on delete cascade,
  expo_ticket_id  text,
  status          text not null default 'sent'
    check (status in ('sent', 'failed', 'receipt_ok', 'receipt_failed')),
  error           text,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (notification_id, device_id)
);

create index if not exists idx_mobile_device_tenant_user
  on mobile_device (tenant_id, user_id, disabled_at);
create index if not exists idx_mobile_device_token
  on mobile_device (expo_push_token);
create index if not exists idx_mobile_push_delivery_notification
  on mobile_push_delivery (tenant_id, notification_id, status);
create index if not exists idx_mobile_push_delivery_device
  on mobile_push_delivery (device_id, sent_at desc);

alter table mobile_device enable row level security;
alter table mobile_push_delivery enable row level security;

drop policy if exists "mobile_device: 본인 기기" on mobile_device;
create policy "mobile_device: 본인 기기" on mobile_device
  for all using (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  )
  with check (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  );

drop policy if exists "mobile_push_delivery: 본인 기기 조회" on mobile_push_delivery;
create policy "mobile_push_delivery: 본인 기기 조회" on mobile_push_delivery
  for select using (
    tenant_id = auth_tenant_id()
    and exists (
      select 1
      from mobile_device d
      where d.id = mobile_push_delivery.device_id
        and d.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on mobile_device to authenticated;
grant select on mobile_push_delivery to authenticated;
revoke insert, update, delete on mobile_push_delivery from authenticated;

create or replace function touch_mobile_device_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mobile_device_updated_at on mobile_device;
create trigger trg_mobile_device_updated_at
before update on mobile_device
for each row execute function touch_mobile_device_updated_at();
