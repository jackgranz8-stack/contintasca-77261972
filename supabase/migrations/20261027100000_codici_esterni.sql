-- Siri (Comandi Rapidi) e widget (Scriptable).
-- 1) Codici personali per Siri e widget.
-- Si salva solo l'impronta SHA-256 del codice, mai il codice in chiaro.
-- Da eseguire una volta in Supabase → SQL Editor → New query → Run.

create table if not exists public.codici_esterni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  hash text not null unique,
  nome text not null default 'Siri e widget',
  creato timestamptz not null default now(),
  ultimo_uso timestamptz
);

alter table public.codici_esterni enable row level security;

-- Dall'app ognuno vede, crea e revoca solo i propri codici.
-- La funzione assistente-vocale li legge con la chiave di servizio.
drop policy if exists "codici: vedo i miei" on public.codici_esterni;
create policy "codici: vedo i miei" on public.codici_esterni
  for select using (auth.uid() = user_id);

drop policy if exists "codici: creo i miei" on public.codici_esterni;
create policy "codici: creo i miei" on public.codici_esterni
  for insert with check (auth.uid() = user_id);

drop policy if exists "codici: revoco i miei" on public.codici_esterni;
create policy "codici: revoco i miei" on public.codici_esterni
  for delete using (auth.uid() = user_id);

-- 2) Quando è stata inserita ogni spesa: serve a Siri per capire qual è
--    "l'ultima spesa". Se la colonna c'è già non cambia nulla; se manca, le
--    spese esistenti prendono la data di oggi e quelle nuove la propria.
alter table public.transactions
  add column if not exists created_at timestamptz not null default now();
