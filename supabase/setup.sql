-- Target: picksell (vdwkghogrutalcxacchf). Applied via add_picksell_private_storage.
-- No app accounts yet: only the server's privileged key may read/write.
create table if not exists public.picksell_analyses (
  id uuid primary key,
  image_path text not null unique,
  title text not null,
  observations jsonb not null check (jsonb_typeof(observations) = 'array'),
  limitations jsonb not null check (jsonb_typeof(limitations) = 'array'),
  model text not null,
  created_at timestamptz not null default now()
);
alter table public.picksell_analyses enable row level security;
revoke all on public.picksell_analyses from public, anon, authenticated;
grant select, insert, update, delete on public.picksell_analyses to service_role;
-- Create a PRIVATE bucket named picksell-work via Storage API/dashboard.
-- Allow image/jpeg only, 6 MB max. No public storage policies.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('picksell-work','picksell-work',false,6000000,ARRAY['image/jpeg'])
on conflict (id) do nothing;

alter table public.picksell_analyses add column if not exists service_draft jsonb
check (service_draft is null or (jsonb_typeof(service_draft)='object'
  and service_draft->>'schema_version'='picksell.service-draft.v1'));

-- Video evidence update (allow_picksell_video_evidence)
update storage.buckets set file_size_limit=24000000,
allowed_mime_types=ARRAY['image/jpeg','video/mp4','video/webm','video/quicktime']
where id='picksell-work';
