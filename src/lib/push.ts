import { db } from "@/integrations/external/client";

/**
 * Chiave pubblica VAPID: è pensata per stare nel codice client, non è un segreto
 * (la chiave privata corrispondente vive solo lato server, nella Edge Function).
 */
const VAPID_PUBLIC_KEY =
  "BB0963WBeRbJUE3oh02vyOcUBDyDLhSsYcK7G-z0qlS57Z2vGDk39a0dS4oIeLjGcIyGRkWVXmiwpQUqJTX1zEA";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/** Chiede il permesso, registra il service worker e salva la sottoscrizione su Supabase. */
export async function enablePush(userId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"]) return false;

  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"],
      auth: json.keys["auth"],
    },
    { onConflict: "endpoint" },
  );
  return !error;
}

export async function disablePush(userId: string): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", userId);
    await sub.unsubscribe();
  }
}

/**
 * Chiede alla Edge Function di inviare una notifica push a tutti i dispositivi
 * dell'utente attualmente autenticato (la funzione ignora qualsiasi altro id:
 * invia sempre e solo a chi ha fatto la richiesta).
 */
export async function sendPush(title: string, body: string, url = "/"): Promise<void> {
  try {
    await db.functions.invoke("send-push", { body: { title, body, url } });
  } catch {
    // Invio best-effort: se fallisce non blocchiamo l'uso dell'app.
  }
}
