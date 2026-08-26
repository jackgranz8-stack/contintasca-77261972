# Conti in Tasca

App per la gestione di spese personali e budget mensile, pensata per essere installata su iPhone come PWA ("Aggiungi alla schermata Home") e utilizzabile anche da desktop.

## Funzionalità

- **Home**: riepilogo mensile, andamento spese, ripartizione per categoria, budget per categoria, consigli intelligenti basati sui dati reali (ritmo di spesa, anomalie, spese fisse da rendere ricorrenti).
- **Storico**: filtri per mese e categoria (selezionabili insieme), ricerca testuale, esportazione in Excel.
- **Budget**: budget per categoria, categorie personalizzabili (nome, icona, colore), spese ricorrenti mensili.
- **Profilo**: dati personali, sblocco con Face ID, notifiche push, import/export Excel, reset dati.
- Account e sincronizzazione dati tramite Supabase, con coda offline per le modifiche fatte senza connessione.

## Stack tecnico

- [TanStack Start](https://tanstack.com/start) (React) + [TanStack Router](https://tanstack.com/router)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — autenticazione, database, Edge Functions per le notifiche push
- Hosting: [Vercel](https://vercel.com), con deploy automatico da GitHub

## Sviluppo locale

Richiede Node.js e npm.

```sh
git clone https://github.com/jackgranz8-stack/contintasca-77261972.git
cd contintasca-77261972
npm install
npm run dev
```

Crea un file `.env` con le variabili d'ambiente Supabase (vedi `src/integrations/supabase/client.ts` per i nomi richiesti: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

## Script disponibili

- `npm run dev` — avvia il server di sviluppo
- `npm run build` — build di produzione
- `npm run lint` — controllo lint
- `npm run format` — formattazione del codice
