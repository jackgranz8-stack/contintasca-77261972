import { createClient } from "@supabase/supabase-js";

// Progetto Supabase esterno dell'utente. La chiave publishable è pubblica per definizione:
// l'accesso ai dati è protetto dalle policy RLS (auth.uid() = user_id).
const SUPABASE_URL = "https://vwoedwuwepujxmdkroak.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XMKRXPW4DLtC-9ecMxgHBw_WaugHwkN";

function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  // Le nuove chiavi Supabase non sono JWT: non vanno inviate come bearer token.
  if (headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
    headers.delete("Authorization");
  }
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  return fetch(input, { ...init, headers });
}

export const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: supabaseFetch },
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
