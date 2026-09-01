/*
 * Service worker: notifiche push + copia offline dell'app.
 *
 * REGOLA DI FONDO, per non rischiare mai dati vecchi o sbagliati:
 * tutto ciò che riguarda i DATI (Supabase: spese, categorie, budget,
 * login) NON viene mai messo in memoria qui. Quelle richieste passano
 * dritte alla rete, esattamente come prima. In memoria finisce solo il
 * "guscio" dell'app — la pagina, i fogli di stile, il codice, le icone —
 * cioè le cose che non cambiano fra un'apertura e l'altra.
 *
 * Così, senza rete, l'app si apre e mostra i dati già salvati sul telefono
 * invece della pagina di errore del browser.
 */

// Cambiando questo numero si buttano via tutte le copie vecchie al primo
// avvio dopo un aggiornamento: è la sicurezza contro l'app "che resta
// indietro" dopo una modifica.
const CACHE = "conti-in-tasca-v1";

// Il minimo indispensabile per aprire l'app da spenta, senza rete.
const PRECACHE = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Se anche solo uno di questi file non si scarica, l'installazione
      // non deve fallire in blocco: si prende quello che c'è.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo letture semplici: salvataggi e modifiche non si toccano mai.
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Tutto ciò che sta su un altro dominio (Supabase in primis) passa dritto
  // alla rete: nessuna intercettazione, nessuna copia.
  if (url.origin !== self.location.origin) return;

  // Anche sul nostro dominio, le chiamate ai dati restano fuori.
  if (url.pathname.startsWith("/api/")) return;

  // APERTURA DI UNA PAGINA: prima la rete (così si vede sempre la versione
  // aggiornata quando c'è campo), e solo se la rete manca si ripesca la
  // copia salvata.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit || Response.error())),
    );
    return;
  }

  // FILE DELL'APP (codice, stili, caratteri, icone): si mostra subito la
  // copia salvata — apertura istantanea — e intanto, in sottofondo, si
  // scarica la versione nuova per la volta successiva.
  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|mjs|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);

  if (!isAsset) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      const fromNetwork = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fromNetwork;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Conti in Tasca", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Conti in Tasca";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
