import { describe, expect, it } from "vitest";
import { canAddTaskRex, homePathFor, isOverdueReservation, pendingActions } from "./role-home";

describe("page d'arrivée par rôle", () => {
  it("le Bureau arrive sur la console, même s'il est aussi pro", () => {
    expect(homePathFor({ isBureau: true, isPro: true })).toBe("/admin");
  });
  it("le pro validé arrive dans son espace", () => {
    expect(homePathFor({ isBureau: false, isPro: true })).toBe("/espace-pro");
  });
  it("le particulier arrive sur Mon chien / accueil membre", () => {
    expect(homePathFor({ isBureau: false, isPro: false })).toBe("/member");
  });
});

describe("actions en attente", () => {
  it("masque les compteurs à zéro et garde l'ordre d'urgence", () => {
    const out = pendingActions([
      { key: "a", label: "Adhésions", count: 2, to: "/admin/validation" },
      { key: "b", label: "Tâches", count: 0, to: "/admin/validation" },
      { key: "c", label: "Matériel", count: 1, to: "/inventory" },
    ]);
    expect(out.map((i) => i.key)).toEqual(["a", "c"]);
  });
  it("garde une information indisponible plutôt que d'annoncer « rien à faire »", () => {
    expect(pendingActions([{ key: "x", label: "Remboursements", count: null, to: "/finance" }])).toHaveLength(1);
  });
});

describe("matériel en retard", () => {
  it("en retard seulement si en cours et date de fin dépassée", () => {
    expect(isOverdueReservation({ status: "ACTIVE", end_date: "2026-11-01" }, "2026-11-08")).toBe(true);
    expect(isOverdueReservation({ status: "ACTIVE", end_date: "2026-11-08" }, "2026-11-08")).toBe(false);
    expect(isOverdueReservation({ status: "RETURNED", end_date: "2026-11-01" }, "2026-11-08")).toBe(false);
    expect(isOverdueReservation({ status: "ACTIVE", end_date: null }, "2026-11-08")).toBe(false);
  });
});

describe("retour d'expérience depuis une tâche", () => {
  it("exige une tâche validée, un projet et un responsable", () => {
    expect(canAddTaskRex({ status: "COMPLETED", project_id: "p" }, true)).toBe(true);
    expect(canAddTaskRex({ status: "IN_PROGRESS", project_id: "p" }, true)).toBe(false);
    expect(canAddTaskRex({ status: "COMPLETED", project_id: null }, true)).toBe(false);
    expect(canAddTaskRex({ status: "COMPLETED", project_id: "p" }, false)).toBe(false);
  });
});
