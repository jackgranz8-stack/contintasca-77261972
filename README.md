# Conti in Tasca

Crea una web app chiamata "Conti in Tasca" per gestire spese personali e budget mensile. Deve essere perfetta su iPhone via Safari (installabile come PWA con "Aggiungi alla schermata Home") e funzionare anche da desktop. VINCOLI TECNICI - Nessun backend, nessun login: tutti i dati salvati in localStorage del browser - Aggiungi manifest.json + meta tag apple-mobile-web-app-capable e apple-touch-icon per l'installazione su iPhone - Design: tema scuro, sfondo quasi nero (#0A0F0C), colore accento verde lime (#8CE562), card con angoli arrotondati (20-24px) e leggero gradiente scuro, font di sistema (-apple-system) - Layout mobile-first, larghezza massima ~430px centrata anche su desktop MODELLO DATI - categorie: {id, nome, icona, colore, budget mensile} - transazioni: {id, importo, categoria, data, nota} - spese ricorrenti: {id, nome, categoria, importo, giorno del mese 1-28, attiva} - profilo: nome, flag onboarding completato SCHERMATE 1) Onboarding (solo al primo accesso, a step): - benvenuto + nome opzionale - budget mensile totale disponibile - profilo rapido: situazione abitativa (affitto/mutuo/proprietà/vivo in famiglia), se ha un'auto, numero persone in famiglia - selezione categorie (default: Casa, Cibo, Auto, Bollette, Spese mediche, Svago, Altro) + possibilità di aggiungerne di personalizzate con icona a scelta - proposta automatica di budget per categoria dividendo il totale in percentuali sensate in base alle risposte (es. affitto pesa più su Casa, più persone pesano più su Cibo/Bollette), modificabile - riepilogo e conferma 2) Home: - card in alto: speso nel mese (o nel mese/categoria selezionati), barra di progresso colorata (verde/giallo/rosso), testo "ti restano X€ su Y€" - grafico a barre "Andamento" degli ultimi 6 mesi, cliccabile per selezionare un mese (aggiorna tutta la pagina) - pillole categoria + grafico a ciambella "Dove finiscono i soldi" con totale al centro - lista "Budget per categoria" con barra di avanzamento per ciascuna - pulsante flottante rotondo "+" fisso in basso a destra per aggiungere una spesa (non deve stare in mezzo alle card) - "Consigli intelligenti" (card sopra il riepilogo, basati solo su dati reali): a) ritmo di spesa del mese vs budget, con proiezione a fine mese se troppo alto b) budget da impostare/aumentare/diminuire per categoria in base alla media degli ultimi 3 mesi c) aumenti anomali di spesa in una categoria vs la sua media d) spese fisse non ancora ricorrenti (stesso importo 3 mesi di fila) con pulsante per attivarle come ricorrenti in un tap - ogni consiglio ha un pulsante di azione + "Ignora" 3) Storico: - filtri per mese (incluso "Tutto") e categoria - totale filtrato + numero transazioni - stesso grafico a barre/donut sul periodo filtrato - pulsante "Esporta questo filtro in Excel" - lista transazioni con eliminazione (con conferma) 4) Budget: - budget totale (somma categorie) - categorie con budget modificabile inline, aggiungi/elimina categoria (non eliminabile se in uso) - sezione "Spese ricorrenti": lista con importo/giorno del mese, pausa/riattiva/elimina, form per aggiungerne. Le ricorrenti attive si registrano da sole come transazioni quando si apre l'app, se il giorno è passato e non ancora generate quel mese 5) Profilo: - nome modificabile, statistiche (transazioni totali, data primo utilizzo) - sezione Excel: esporta tutte le transazioni in .xlsx (colonne Data, Categoria, Importo, Nota), importa da un .xlsx esistente (crea categorie mancanti, ignora righe non valide), scarica modello vuoto - "Reimposta app" con doppia conferma MODALE AGGIUNGI SPESA: importo, categoria (selezione visuale a icone), data (default oggi), nota opzionale, toggle "Ripeti ogni mese" con giorno 1-28 che crea anche una regola ricorrente NAVIGAZIONE: barra in basso con Home, Storico, Budget, Profilo Toast in alto (es. "Spesa registrata") che scompare da solo dopo 2-3 secondi.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://contintasca.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0fd048e8-69bb-4c26-89e5-860064503089).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
