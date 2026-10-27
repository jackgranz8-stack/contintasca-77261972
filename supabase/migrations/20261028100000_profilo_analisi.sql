-- Profilo più completo per l'analisi delle spese:
-- regione (media italiana per area), quota di affitto/mutuo pagata
-- (casa divisa), reddito netto mensile facoltativo.
-- Da eseguire PRIMA di caricare la nuova versione dell'app:
-- Supabase → SQL Editor → New query → incolla → Run.

alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists housing_share numeric not null default 1
  check (housing_share > 0 and housing_share <= 1);
alter table public.profiles add column if not exists net_income numeric
  check (net_income is null or net_income > 0);
