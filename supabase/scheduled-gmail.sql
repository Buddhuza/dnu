-- Retired daily Gmail schedule. Run to remove any remaining legacy jobs.
-- Weekend and holiday AUTOSEND is configured in scheduled-autosend.sql.
select cron.unschedule(jobid) from cron.job where jobname like 'dnu-email-%';
