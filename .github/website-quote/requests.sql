-- Additive only. No employee portal tables, policies or functions are changed.
create table public.website_quote_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text not null,
  ip_hash text not null,
  email_hash text not null,
  notification_status text not null default 'pending'
    check (notification_status in ('pending','accepted','unconfirmed')),
  provider_id text,
  notified_at timestamptz,
  error_code text
);
create index website_quote_created_idx on public.website_quote_requests(created_at);
create index website_quote_ip_idx on public.website_quote_requests(ip_hash,created_at);
create index website_quote_email_idx on public.website_quote_requests(email_hash,created_at);
alter table public.website_quote_requests enable row level security;
revoke all on public.website_quote_requests from public, anon, authenticated;
grant select, insert, update on public.website_quote_requests to service_role;
comment on table public.website_quote_requests is
  'Private website quote requests. Server-only access; no employee or public client access. Review unconfirmed email notifications in Supabase Table Editor.';

create function public.reserve_website_quote(
  request_id uuid, request_payload jsonb, request_hash text,
  source_hash text, sender_hash text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare existing public.website_quote_requests;
begin
  -- One short transaction protects both deduplication and all rolling counters.
  perform pg_advisory_xact_lock(51511052026);
  select * into existing from public.website_quote_requests where id=request_id;
  if found then
    if existing.payload_hash <> request_hash then
      return jsonb_build_object('outcome','conflict');
    end if;
    return jsonb_build_object('outcome','duplicate','notification',existing.notification_status);
  end if;
  if (select count(*) from public.website_quote_requests where created_at>now()-interval '24 hours') >= 100
     or (select count(*) from public.website_quote_requests where ip_hash=source_hash and created_at>now()-interval '15 minutes') >= 5
     or (select count(*) from public.website_quote_requests where email_hash=sender_hash and created_at>now()-interval '1 hour') >= 3 then
    return jsonb_build_object('outcome','limited');
  end if;
  insert into public.website_quote_requests(id,payload,payload_hash,ip_hash,email_hash)
    values(request_id,request_payload,request_hash,source_hash,sender_hash);
  return jsonb_build_object('outcome','created');
end $$;
revoke all on function public.reserve_website_quote(uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_website_quote(uuid,jsonb,text,text,text) to service_role;
