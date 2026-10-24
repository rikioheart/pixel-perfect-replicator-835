import { describe, expect, it } from "vitest";
import { activeAccesses, availablePros, isAccessActive, SHARE_PRESETS, shareResultMessage, NO_PERMS } from "./dog-sharing";
import { buildDogTimeline } from "./dog-timeline";

const now = new Date("2026-10-23T12:00:00Z");
const row = (id: string, pro: string, extra: Partial<{ revoked: boolean; expires_at: string | null }> = {}) => ({
  id, professional_id: pro, revoked: false, expires_at: null, ...NO_PERMS, can_identity: true, ...extra,
});

describe("accès actifs au dossier du chien", () => {
  it("un accès retiré n'est plus actif", () => expect(isAccessActive({ revoked: true, expires_at: null }, now)).toBe(false));
  it("un accès expiré n'est plus actif", () =>
    expect(isAccessActive({ revoked: false, expires_at: "2026-10-01T00:00:00Z" }, now)).toBe(false));
  it("un accès sans date de fin reste actif", () => expect(isAccessActive({ revoked: false, expires_at: null }, now)).toBe(true));
  it("ne garde que les accès en cours", () => {
    const rows = [row("a", "p1"), row("b", "p2", { revoked: true }), row("c", "p3", { expires_at: "2026-09-01T00:00:00Z" })];
    expect(activeAccesses(rows, now).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("partage avec plusieurs professionnels", () => {
  it("ne repropose pas un professionnel qui a déjà un accès actif, mais repropose celui dont l'accès est retiré", () => {
    const pros = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const rows = [row("a", "p1"), row("b", "p2", { revoked: true })];
    expect(availablePros(pros, rows, now).map((p) => p.id)).toEqual(["p2", "p3"]);
  });
  it("annonce le nombre de professionnels et ceux déjà servis", () => {
    const names: Record<string, string> = { p1: "Léa", p2: "Marc", p3: "Inès" };
    expect(shareResultMessage({ shared: ["p1", "p2"], skipped: ["p3"] }, (id) => names[id]!)).toBe(
      "Dossier ouvert à 2 professionnels. Déjà partagé avec Inès : modifiez son accès si besoin.",
    );
  });
  it("la fiche pratique n'ouvre jamais objectifs ni observations", () => {
    const p = SHARE_PRESETS.find((x) => x.id === "pratique")!.perms;
    expect(p.can_goals || p.can_observations).toBe(false);
  });
});

describe("carnet de vie : statuts réels des objectifs", () => {
  it("affiche « atteint » pour un objectif ATTEINT", () => {
    const t = buildDogTimeline({ observations: [], outings: [], goals: [{ id: "g", title: "Rappel", status: "ATTEINT", created_at: "2026-10-01" }] }, now);
    expect(t[0]?.detail).toBe("atteint");
  });
});
