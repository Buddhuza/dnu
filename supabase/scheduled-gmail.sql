-- The DNU scheduler token must already exist in vault.decrypted_secrets.
-- Cron runs in UTC. The Edge Function accepts only 16:00, 16:10 or 16:20 Vienna time.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'dnu_schedule_token') then
    raise exception 'Create the dnu_schedule_token Vault secret before scheduling Gmail.';
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname in ('dnu-email-1130', 'dnu-email-1140', 'dnu-email-1150', 'dnu-email-1200', 'dnu-email-1210', 'dnu-email-1230', 'dnu-email-1240', 'dnu-email-1250', 'dnu-email-1300', 'dnu-email-1310', 'dnu-email-1400', 'dnu-email-1410', 'dnu-email-1420', 'dnu-email-1500', 'dnu-email-1510', 'dnu-email-1520');

select cron.schedule('dnu-email-1400', '0 14 * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
select cron.schedule('dnu-email-1410', '10 14 * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
select cron.schedule('dnu-email-1420', '20 14 * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
select cron.schedule('dnu-email-1500', '0 15 * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
select cron.schedule('dnu-email-1510', '10 15 * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
select cron.schedule('dnu-email-1520', '20 15 * * *', $job$
  select net.http_post(
    url := 'https://epghsyajgspcywqqbfso.supabase.co/functions/v1/schedule-dnu-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dnu-schedule-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'dnu_schedule_token')),
    body := '{}'::jsonb
  );
$job$);
