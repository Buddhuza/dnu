-- Run once in the existing Supabase project's SQL Editor.
-- Create each colleague in Authentication > Users, then add their user_id here.
create table if not exists public.dnu_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z][a-z0-9_]{2,31}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  role text not null default 'editor' check (role in ('owner', 'editor')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.dnu_editors add column if not exists username text;
create unique index if not exists dnu_editors_username_key on public.dnu_editors (username);

alter table public.dnu_editors enable row level security;
revoke all on public.dnu_editors from anon, authenticated;
grant select on public.dnu_editors to authenticated;
drop policy if exists "Editors can read their own profile" on public.dnu_editors;
create policy "Editors can read their own profile"
  on public.dnu_editors for select to authenticated using (user_id = auth.uid());

insert into public.dnu_editors (user_id, username, display_name, role)
select id, 'lkhubulava', 'lkhubulava', 'owner' from auth.users
where lower(email) = 'buddhuza@gmail.com'
on conflict (user_id) do update set username = 'lkhubulava', display_name = 'lkhubulava', role = 'owner', active = true;

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
declare editor_role text;
begin
  select role into editor_role from public.dnu_editors where user_id = auth.uid() and active = true;
  if auth.role() <> 'authenticated' or editor_role is null then
    raise exception 'Only an active DNU editor may publish an update' using errcode = '42501';
  end if;
  if jsonb_typeof(p_update) <> 'object' or jsonb_typeof(p_settings) <> 'object'
     or jsonb_typeof(p_excluded_story_ids) <> 'array' or jsonb_typeof(p_bodies) <> 'array' then
    raise exception 'Invalid DNU update data';
  end if;
  if editor_role <> 'owner' and exists (
    select 1 from public.dnu_state where id = 'main'
      and (settings - array['sections','articleEdits','articleOrder','leadOrigins','customCountries','customArticles']::text[])
        is distinct from
        (p_settings - array['sections','articleEdits','articleOrder','leadOrigins','customCountries','customArticles']::text[])
  ) then
    raise exception 'Only the owner may change site settings' using errcode = '42501';
  end if;

  update public.dnu_state
     set revision = revision + 1, edition = p_update, settings = p_settings,
         excluded_story_ids = p_excluded_story_ids, compiled_at = p_compiled_at,
         updated_at = now()
   where id = 'main' and revision = p_expected_revision
   returning revision into next_revision;
  if next_revision is null then return null; end if;

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

-- Editors are provisioned with scripts/create-editor-accounts.mjs.
