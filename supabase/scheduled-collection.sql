-- Run once in the DNU project after deploying schedule-dnu-collection.
-- The existing dnu_schedule_token Vault secret is shared with the email cron.
-- This hourly check does not scrape unless the current Vienna slot is missing.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'dnu_schedule_token') then
    raise exception 'Create the dnu_schedule_token Vault secret before enabling collection recovery.';
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'dnu-collection-recovery';

select cron.schedule('dnu-collection-recovery', '5 * * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-collection',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
