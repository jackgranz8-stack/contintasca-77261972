import { describe, expect, it, vi } from "vitest";

// Database finto: 2500 spese, più delle 1000 che Supabase dà per richiesta.
const SPESE = Array.from({ length: 2500 }, (_, i) => ({
  id: String(i).padStart(5, "0"),
  user_id: "U",
  category_id: "c",
  amount: 1,
  date: "2026-10-01",
  note: `n${i}`,
  recurring_id: null,
}));

vi.mock("@/integrations/external/client", () => {
  const tabelle: Record<string, unknown[]> = {
    transactions: SPESE,
    categories: [{ id: "c", user_id: "U", name: "Cibo", budget: 0 }],
    recurring: [],
    dismissed_insights: [],
    profiles: [],
  };
  const from = (t: string) => {
    let range: [number, number] | null = null;
    let single = false;
    const b = {
      select: () => b,
      eq: () => b,
      order: () => b,
      range: (a: number, z: number) => {
        range = [a, Math.min(z, a + 999)]; // come Supabase: massimo 1000
        return b;
      },
      maybeSingle: () => {
        single = true;
        return b;
      },
      then: (ok: (v: unknown) => unknown) => {
        const righe = tabelle[t] ?? [];
        const data = single
          ? (righe[0] ?? null)
          : range
            ? righe.slice(range[0], range[1] + 1)
            : righe.slice(0, 1000);
        return Promise.resolve({ data, error: null }).then(ok);
      },
    };
    return b;
  };
  return { db: { from } };
});

describe("loadRemoteState", () => {
  it("legge tutte le spese, anche oltre le 1000", async () => {
    const { loadRemoteState } = await import("./remote");
    const s = await loadRemoteState("U");
    expect(s.transazioni).toHaveLength(2500);
    expect(new Set(s.transazioni.map((t) => t.id)).size).toBe(2500);
  });
});
