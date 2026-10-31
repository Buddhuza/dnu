-- Run in a new Supabase project's SQL editor. The browser uses only the public
-- anon key. Never put a service-role key or a password in the website build.
create table if not exists public.dnu_state (
  id text primary key,
  revision bigint not null default 0,
  edition jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  excluded_story_ids jsonb not null default '[]'::jsonb,
  compiled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.dnu_state (id) values ('main') on conflict (id) do nothing;

create table if not exists public.dnu_bodies (
  url text primary key,
  heading text not null,
  body text not null,
  translated boolean not null default false
);

alter table public.dnu_state enable row level security;
alter table public.dnu_bodies enable row level security;
revoke all on public.dnu_state, public.dnu_bodies from anon, authenticated;
grant select on public.dnu_state, public.dnu_bodies to anon, authenticated;
grant all on public.dnu_state, public.dnu_bodies to service_role;

drop policy if exists "Anyone can read the published update" on public.dnu_state;
create policy "Anyone can read the published update"
  on public.dnu_state for select to anon, authenticated using (id = 'main');
drop policy if exists "Anyone can read published article bodies" on public.dnu_bodies;
create policy "Anyone can read published article bodies"
  on public.dnu_bodies for select to anon, authenticated using (true);

create or replace function public.publish_dnu_state(
  p_expected_revision bigint,
  p_update jsonb,
  p_settings jsonb,
  p_excluded_story_ids jsonb,
  p_compiled_at timestamptz,
  p_bodies jsonb default '[]'::jsonb,
  p_replace_bodies boolean default false
)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
as $$
declare next_revision bigint;
begin
  if auth.role() <> 'authenticated' or auth.jwt() ->> 'email' <> 'buddhuza@gmail.com' then
    raise exception 'Only the DNU editor may publish an update' using errcode = '42501';
  end if;
  if jsonb_typeof(p_update) <> 'object' or jsonb_typeof(p_settings) <> 'object'
     or jsonb_typeof(p_excluded_story_ids) <> 'array' or jsonb_typeof(p_bodies) <> 'array' then
    raise exception 'Invalid DNU update data';
  end if;

  update public.dnu_state
     set revision = revision + 1, edition = p_update, settings = p_settings,
         excluded_story_ids = p_excluded_story_ids, compiled_at = p_compiled_at,
         updated_at = now()
   where id = 'main' and revision = p_expected_revision
   returning revision into next_revision;
  if next_revision is null then return null; end if;

  -- Some Supabase projects enforce safe updates, which reject DELETE without
  -- an explicit WHERE clause. url is the non-null primary key.
  if p_replace_bodies then delete from public.dnu_bodies where url is not null; end if;
  insert into public.dnu_bodies (url, heading, body, translated)
  select item.value ->> 'url', coalesce(item.value ->> 'heading', ''), item.value ->> 'body',
         coalesce((item.value ->> 'translated')::boolean, false)
    from jsonb_array_elements(p_bodies) as item(value)
   where item.value ->> 'url' is not null and length(item.value ->> 'body') > 0
  on conflict (url) do update set heading = excluded.heading,
    body = excluded.body, translated = excluded.translated;
  return next_revision;
end;
$$;

revoke all on function public.publish_dnu_state(bigint,jsonb,jsonb,jsonb,timestamptz,jsonb,boolean) from public;
grant execute on function public.publish_dnu_state(bigint,jsonb,jsonb,jsonb,timestamptz,jsonb,boolean) to authenticated;

-- The offline NEWSRUN publisher uses a service-role key stored only in its
-- execution environment. It replaces the edition and cached full bodies in
-- the same transaction, while preserving theme and section settings.
create or replace function public.publish_dnu_snapshot(
  p_update jsonb,
  p_settings jsonb,
  p_bodies jsonb
)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
as $$
declare next_revision bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_update) <> 'object' or jsonb_typeof(p_settings) <> 'object'
     or jsonb_typeof(p_bodies) <> 'array' then
    raise exception 'Invalid DNU snapshot';
  end if;
  update public.dnu_state set revision = revision + 1, edition = p_update,
    settings = p_settings, excluded_story_ids = '[]'::jsonb,
    compiled_at = coalesce((p_update ->> 'checkedAt')::timestamptz, now()),
    updated_at = now() where id = 'main' returning revision into next_revision;
  delete from public.dnu_bodies where url is not null;
  insert into public.dnu_bodies (url, heading, body, translated)
  select item.value ->> 'url', coalesce(item.value ->> 'heading', ''), item.value ->> 'body',
         coalesce((item.value ->> 'translated')::boolean, false)
    from jsonb_array_elements(p_bodies) as item(value)
   where item.value ->> 'url' is not null and length(item.value ->> 'body') > 0
  on conflict (url) do update set heading = excluded.heading,
    body = excluded.body, translated = excluded.translated;
  return next_revision;
end;
$$;

revoke all on function public.publish_dnu_snapshot(jsonb,jsonb,jsonb) from public;
grant execute on function public.publish_dnu_snapshot(jsonb,jsonb,jsonb) to service_role;
