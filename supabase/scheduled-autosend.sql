-- Replace all old daily-email jobs with AUTOSEND recovery checks.
-- The Edge Function enforces 08:00 Europe/Vienna, weekends, holidays and the
-- one-time 2026-11-20 22:15 test. Checks continue until email submission succeeds.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'dnu_schedule_token') then
    raise exception 'Create the dnu_schedule_token Vault secret before enabling AUTOSEND.';
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname like 'dnu-email-%' or jobname = 'dnu-autosend-recovery';

select cron.schedule('dnu-autosend-recovery', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-autosend',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
