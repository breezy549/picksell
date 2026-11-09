-- PickSell: public offers are served through the server API, not direct table access.
create table if not exists public.picksell_services (
 id uuid primary key,
 receipt_id uuid not null unique,
 manage_token_hash text not null,
 public_data jsonb not null check (jsonb_typeof(public_data)='object'),
 status text not null default 'active' check (status in ('active','closed')),
 created_at timestamptz not null default now()
);
create table if not exists public.picksell_quote_requests (
 id uuid primary key,
 service_id uuid not null references public.picksell_services(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 status text not null default 'pending' check (status in ('pending','reviewing','declined')),
 created_at timestamptz not null default now()
);
create index if not exists picksell_quote_service_created on public.picksell_quote_requests(service_id,created_at desc);
alter table public.picksell_services enable row level security;
alter table public.picksell_quote_requests enable row level security;
revoke all on public.picksell_services, public.picksell_quote_requests from public, anon, authenticated;
grant select,insert,update,delete on public.picksell_services, public.picksell_quote_requests to service_role;

-- Atomic per-service cap and idempotency; only the server may invoke this function.
create or replace function public.picksell_submit_quote(p_service_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_request public.picksell_quote_requests; current_status text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_service_id::text,0));
 select * into old_request from public.picksell_quote_requests where id=p_request_id;
 if found then
   if old_request.service_id<>p_service_id or old_request.payload<>p_payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('id',old_request.id,'status',old_request.status,'duplicate',true);
 end if;
 select status into current_status from public.picksell_services where id=p_service_id;
 if current_status is distinct from 'active' then raise exception 'SERVICE_UNAVAILABLE'; end if;
 if (select count(*) from public.picksell_quote_requests where service_id=p_service_id and created_at>now()-interval '1 hour')>=20 then
   raise exception 'RATE_LIMITED';
 end if;
 insert into public.picksell_quote_requests(id,service_id,payload) values(p_request_id,p_service_id,p_payload);
 return jsonb_build_object('id',p_request_id,'status','pending','duplicate',false);
end;
$$;
revoke all on function public.picksell_submit_quote(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.picksell_submit_quote(uuid,uuid,jsonb) to service_role;
