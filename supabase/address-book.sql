-- Apply to the existing DNU project before deploying the address-book interface.
-- Contacts and selected recipients are visible only to active editors and service_role.
create table if not exists public.dnu_address_book (
  email text primary key,
  display_name text not null default '',
  company text not null default '',
  category text not null default '',
  selected boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint valid_contact_email check (length(email) <= 254 and email = lower(email) and email ~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'),
  constraint valid_contact_fields check (length(display_name) <= 160 and length(company) <= 160 and length(category) <= 120)
);

alter table public.dnu_address_book enable row level security;
revoke all on public.dnu_address_book from anon, authenticated;
grant select, insert, update, delete on public.dnu_address_book to authenticated;
grant all on public.dnu_address_book to service_role;
drop policy if exists "Active DNU editors manage the address book" on public.dnu_address_book;
create policy "Active DNU editors manage the address book"
  on public.dnu_address_book for all to authenticated
  using (exists (select 1 from public.dnu_editors where user_id = auth.uid() and active = true))
  with check (exists (select 1 from public.dnu_editors where user_id = auth.uid() and active = true));

-- Migrate the existing BCC list once. Re-running this file does not reselect old contacts.
insert into public.dnu_address_book (email, selected)
select distinct lower(trim(value)), true
from public.dnu_state state,
  lateral jsonb_array_elements_text(case when jsonb_typeof(state.settings -> 'gmailRecipients') = 'array'
    then state.settings -> 'gmailRecipients' else '[]'::jsonb end) as recipient(value)
where state.id = 'main' and lower(trim(value)) ~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
on conflict (email) do nothing;

create or replace function public.set_dnu_recipients(p_emails text[])
returns text[]
language plpgsql security definer set search_path = public, pg_temp
as $$
declare chosen text[];
begin
  if auth.role() <> 'authenticated' or not exists (
    select 1 from public.dnu_editors where user_id = auth.uid() and active = true
  ) then raise exception 'Only an active DNU editor may change recipients' using errcode = '42501'; end if;
  select array_agg(email order by email) into chosen from (
    select distinct lower(trim(value)) as email from unnest(p_emails) as item(value)
  ) values_list;
  if coalesce(array_length(chosen, 1), 0) not between 1 and 400 or exists (
    select 1 from unnest(chosen) as recipient(email)
    where length(recipient.email) > 254 or recipient.email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
  ) then raise exception 'Choose between 1 and 400 valid email addresses'; end if;
  insert into public.dnu_address_book(email, selected) select recipient.email, true from unnest(chosen) as recipient(email)
    on conflict (email) do nothing;
  update public.dnu_address_book set selected = email = any(chosen), updated_at = now()
    where selected is distinct from (email = any(chosen));
  return chosen;
end;
$$;
revoke all on function public.set_dnu_recipients(text[]) from public;
grant execute on function public.set_dnu_recipients(text[]) to authenticated;
