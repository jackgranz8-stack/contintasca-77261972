import type { AppState } from "./types";

/**
 * UNIRE LE MODIFICHE FATTE SUL TELEFONO CON LO STATO DEL SERVER
 *
 * Da quando le spese si possono aggiungere, eliminare e modificare anche da
 * Siri, il database può cambiare mentre l'app è chiusa o offline. Se sul
 * telefono c'erano modifiche non ancora sincronizzate, prima si confrontava
 * lo stato del SERVER con quello del telefono: tutto ciò che il telefono non
 * conosceva (per esempio una spesa dettata a Siri) risultava "da eliminare",
 * e veniva cancellato.
 *
 * Ora si guarda solo cosa ha cambiato l'utente sul telefono (differenza fra
 * "base", lo stato all'ultimo salvataggio riuscito, e "locale") e lo si
 * applica sopra al server. Quello che è cambiato altrove resta.
 */

type ConId = { id: string };

function unisciLista<T extends ConId>(remota: T[], base: T[], locale: T[]): T[] {
  const perId = (l: T[]) => new Map(l.map((x) => [x.id, x]));
  const b = perId(base);
  const l = perId(locale);
  const risultato = new Map(remota.map((x) => [x.id, x]));
  // Eliminati sul telefono.
  for (const id of b.keys()) if (!l.has(id)) risultato.delete(id);
  // Aggiunti o modificati sul telefono.
  for (const [id, x] of l) {
    const prima = b.get(id);
    if (!prima || JSON.stringify(prima) !== JSON.stringify(x)) risultato.set(id, x);
  }
  return [...risultato.values()];
}

export function unisciModifiche(remoto: AppState, base: AppState, locale: AppState): AppState {
  return {
    ...remoto,
    categorie: unisciLista(remoto.categorie, base.categorie, locale.categorie),
    transazioni: unisciLista(remoto.transazioni, base.transazioni, locale.transazioni),
    ricorrenti: unisciLista(remoto.ricorrenti, base.ricorrenti, locale.ricorrenti),
    // Profilo e consigli ignorati si modificano solo dall'app.
    profilo:
      JSON.stringify(base.profilo) !== JSON.stringify(locale.profilo)
        ? locale.profilo
        : remoto.profilo,
    consigliIgnorati: [...new Set([...remoto.consigliIgnorati, ...locale.consigliIgnorati])],
  };
}
