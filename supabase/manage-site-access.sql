-- Apply to the existing DNU Supabase project after deploying the app.
-- Keeps Content, Sections and Theme owner-controlled; shares Scope, Stories, Sources and Email.
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
  -- Editors share Scope, Stories, Sources and Email. The owner alone controls
  -- Content, Sections and Theme. Compare protected keys before writing state.
  if editor_role <> 'owner' and exists (
    select 1 from public.dnu_state state,
      lateral jsonb_object_keys(state.settings || p_settings) as protected(key)
    where state.id = 'main'
      and protected.key = any(array['brandName','brandTagline','updateTitle','coverageText',
        'showCoverage','showSources','showUpdate','showScope','showLatest',
        'sections','fontSize','sectionHeadingSize','sectionHeadingUppercase',
        'updateWidth','theme','darkTheme'])
      and state.settings -> protected.key is distinct from p_settings -> protected.key
  ) then
    raise exception 'Only the owner may change Content, Sections or Theme' using errcode = '42501';
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
