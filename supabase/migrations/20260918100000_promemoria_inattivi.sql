-- ============================================================
-- PROMEMORIA PER CHI NON APRE L'APP DA DUE GIORNI
-- ============================================================
-- Da eseguire una volta sola, nell'SQL Editor di Supabase.
-- Tutto è scritto in modo da poter essere rieseguito senza danni.

-- 1) Colonne di servizio su profiles ---------------------------------------
--    last_seen      : ultima apertura dell'app (la scrive l'app stessa)
--    last_reminder  : quando gli è stato mandato l'ultimo promemoria
--    reminder_count : quanti promemoria di fila senza che sia rientrato
--                     (si azzera da solo appena riapre l'app)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminder TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count SMALLINT NOT NULL DEFAULT 0;

-- Indice: la Edge Function cerca proprio per last_seen.
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen);

-- Partenza morbida: chi già usa l'app risulta "visto adesso", così nessuno
-- si becca una raffica di promemoria il giorno stesso dell'aggiornamento.
UPDATE public.profiles SET last_seen = now() WHERE last_seen IS NULL;

-- 2) Estensioni per il lavoro programmato ----------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3) Il lavoro giornaliero -------------------------------------------------
-- pg_cron ragiona in UTC. Le 10:00 italiane sono le 08:00 UTC in ora legale
-- e le 09:00 UTC in ora solare: si programmano entrambe le esecuzioni e si
-- lascia decidere al fuso orario reale dentro la funzione, che esce subito
-- se in Italia non sono le 10. Così l'orario resta corretto tutto l'anno
-- senza dover ricordarsi di spostare il cron a marzo e a ottobre.

SELECT cron.unschedule('promemoria-inattivi')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'promemoria-inattivi');

SELECT cron.schedule(
  'promemoria-inattivi',
  '0 8,9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vwoedwuwepujxmdkroak.supabase.co/functions/v1/promemoria-inattivi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer INSERISCI_QUI_LA_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Per controllare che il lavoro sia registrato:
--   SELECT jobname, schedule, active FROM cron.job;
-- Per vedere le ultime esecuzioni:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
