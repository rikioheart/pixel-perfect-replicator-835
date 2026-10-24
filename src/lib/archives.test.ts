import { describe, expect, it } from "vitest";
import { isPast, operationalProgress, splitArchive } from "./archives";

const now = new Date("2026-10-24T12:00:00");

describe("archives", () => {
  it("une activité terminée passe en historique", () => {
    expect(isPast({ status: "COMPLETED", date: "2027-01-01" }, now)).toBe(true);
  });
  it("une date passée passe en historique", () => {
    expect(isPast({ status: "PUBLISHED", date: "2026-10-20T10:00:00" }, now)).toBe(true);
  });
  it("le jour même reste en cours", () => {
    expect(isPast({ status: "PUBLISHED", date: "2026-10-24T08:00:00" }, now)).toBe(false);
  });
  it("un événement sur plusieurs jours reste en cours jusqu'à sa fin", () => {
    expect(isPast({ start_date: "2026-10-20", end_date: "2026-10-26" }, now)).toBe(false);
  });
  it("rien n'est perdu au tri", () => {
    const r = splitArchive([{ date: "2026-10-01" }, { date: "2026-11-01" }], now);
    expect(r.current.length + r.past.length).toBe(2);
  });
});

describe("avancement opérationnel", () => {
  it("poids égal par tâche, annulées exclues", () => {
    expect(operationalProgress([{ status: "COMPLETED" }, { status: "TODO" }, { status: "CANCELLED" }])).toBe(50);
  });
  it("aucune tâche : pas de pourcentage", () => expect(operationalProgress([])).toBeNull());
});
