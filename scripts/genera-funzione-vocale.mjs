// Genera supabase/functions/assistente-vocale/index.ts a partire da
// sorgente.ts, unendo in un solo file la logica dell'app che usa (src/lib).
// Serve perché la funzione si pubblica incollandola nell'editor di Supabase,
// che accetta un file solo.
//
// Uso:  node scripts/genera-funzione-vocale.mjs
import { build } from "esbuild";

const cartella = "supabase/functions/assistente-vocale";
await build({
  entryPoints: [`${cartella}/sorgente.ts`],
  outfile: `${cartella}/index.ts`,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["npm:*"],
  legalComments: "none",
  banner: {
    js: [
      "// @ts-nocheck",
      "// FILE GENERATO: non modificarlo a mano.",
      "// È sorgente.ts con la logica di src/lib già inclusa, pronto da incollare",
      "// nell'editor di Supabase (funzione assistente-vocale, Verify JWT spento).",
      "// Per rigenerarlo: node scripts/genera-funzione-vocale.mjs",
      "",
    ].join("\n"),
  },
});
console.log(`Generato ${cartella}/index.ts`);
