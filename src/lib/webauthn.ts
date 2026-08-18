/**
 * Blocco locale dell'app con Face ID / Touch ID, tramite l'autenticatore
 * biometrico della piattaforma (WebAuthn). Non sostituisce il login Supabase:
 * è un secondo cancello, solo su questo dispositivo, che si appoggia
 * all'impronta/volto già registrati sul telefono. Nessun server coinvolto:
 * la chiave privata resta nel Secure Enclave del dispositivo, come sempre
 * con WebAuthn — qui verifichiamo solo che la cerimonia sia andata a buon fine.
 */

const STORAGE_PREFIX = "faceid-credential:";

function randomChallenge(): BufferSource {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr as BufferSource;
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): BufferSource {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) as BufferSource;
}

export function faceIdSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined"
  );
}

export function isFaceIdEnabled(userId: string): boolean {
  return typeof localStorage !== "undefined" && !!localStorage.getItem(STORAGE_PREFIX + userId);
}

export function disableFaceId(userId: string) {
  localStorage.removeItem(STORAGE_PREFIX + userId);
}

/** Registra un nuovo credenziale biometrico per questo utente su questo dispositivo. */
export async function enrollFaceId(userId: string, email: string): Promise<boolean> {
  if (!faceIdSupported()) return false;
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: "Conti in Tasca" },
        user: {
          id: new TextEncoder().encode(userId),
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!credential) return false;
    localStorage.setItem(STORAGE_PREFIX + userId, toBase64(credential.rawId));
    return true;
  } catch {
    return false;
  }
}

/** Chiede Face ID / Touch ID per sbloccare. True solo se la verifica biometrica riesce davvero. */
export async function verifyFaceId(userId: string): Promise<boolean> {
  if (!faceIdSupported()) return false;
  const stored = localStorage.getItem(STORAGE_PREFIX + userId);
  if (!stored) return false;
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ id: fromBase64(stored), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!credential;
  } catch {
    return false;
  }
}
