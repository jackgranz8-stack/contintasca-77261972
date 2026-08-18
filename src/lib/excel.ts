import type { Category, Transaction } from "./types";
import { formatDay } from "./format";

type Row = { Data: string; Categoria: string; Importo: number; Nota: string };

function download(XLSX: typeof import("xlsx"), wb: import("xlsx").WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export async function exportTransactions(
  txs: Transaction[],
  categorie: Category[],
  filename = "conti-in-tasca.xlsx",
) {
  const XLSX = await import("xlsx");
  const name = (id: string) => categorie.find((c) => c.id === id)?.nome ?? "Altro";
  const rows: Row[] = [...txs]
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .map((t) => ({
      Data: t.data,
      Categoria: name(t.categoria),
      Importo: Number(t.importo.toFixed(2)),
      Nota: t.nota ?? "",
    }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: ["Data", "Categoria", "Importo", "Nota"] });
  ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transazioni");
  download(XLSX, wb, filename);
  return rows.length;
}

export async function exportTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(
    [{ Data: "2026-01-15", Categoria: "Cibo", Importo: 42.5, Nota: "Spesa settimanale" }],
    { header: ["Data", "Categoria", "Importo", "Nota"] },
  );
  ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transazioni");
  download(XLSX, wb, "modello-conti-in-tasca.xlsx");
}

function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v);
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(",", "."));
    if (Number.isFinite(n) && n !== 0) return Math.abs(n);
  }
  return null;
}

export type ImportResult = {
  righeValide: { data: string; categoria: string; importo: number; nota: string }[];
  nuoveCategorie: string[];
  scartate: number;
};

export async function parseImportFile(file: File, categorie: Category[]): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) return { righeValide: [], nuoveCategorie: [], scartate: 0 };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const righeValide: ImportResult["righeValide"] = [];
  const nuoveCategorie: string[] = [];
  let scartate = 0;

  const pick = (row: Record<string, unknown>, keys: string[]) => {
    for (const k of Object.keys(row)) {
      if (keys.includes(k.trim().toLowerCase())) return row[k];
    }
    return undefined;
  };

  for (const row of raw) {
    const data = parseDate(pick(row, ["data", "date"]));
    const importo = parseAmount(pick(row, ["importo", "amount", "spesa"]));
    const catRaw = String(pick(row, ["categoria", "category"]) ?? "").trim();
    const nota = String(pick(row, ["nota", "note", "descrizione"]) ?? "").trim();
    if (!data || !importo || !catRaw) {
      scartate++;
      continue;
    }
    const esiste = categorie.find((c) => c.nome.toLowerCase() === catRaw.toLowerCase());
    const nomeCat = esiste?.nome ?? catRaw;
    if (!esiste && !nuoveCategorie.includes(nomeCat)) nuoveCategorie.push(nomeCat);
    righeValide.push({ data, categoria: nomeCat, importo, nota });
  }
  return { righeValide, nuoveCategorie, scartate };
}

export { formatDay };
