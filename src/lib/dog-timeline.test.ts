import { describe, expect, it } from "vitest";
import { buildDogTimeline, dogAge, memberRoleLabel } from "./dog-timeline";

const now = new Date("2026-10-10T12:00:00Z");

describe("carnet de vie", () => {
  it("place les sorties à venir en tête puis le passé du plus récent au plus ancien", () => {
    const t = buildDogTimeline({
      observations: [{ id: "1", body: "calme", created_at: "2026-09-01T00:00:00Z" }],
      goals: [{ id: "2", title: "Rappel", status: "DONE", created_at: "2026-10-01T00:00:00Z" }],
      outings: [{ id: "3", title: "Balade", date: "2026-10-20T00:00:00Z", status: "CONFIRMED" }],
    }, now);
    expect(t.map((i) => i.key)).toEqual(["o-3", "g-2", "b-1"]);
  });
  it("ignore les sorties annulées", () => {
    const t = buildDogTimeline({ observations: [], goals: [], outings: [{ id: "x", title: "A", date: "2026-01-01", status: "CANCELLED" }] }, now);
    expect(t).toHaveLength(0);
  });
});

describe("âge du chien", () => {
  it("affiche les mois avant un an", () => expect(dogAge("2026-04-10", now)).toBe("6 mois"));
  it("affiche les années ensuite", () => expect(dogAge("2023-10-01", now)).toBe("3 ans"));
});

describe("libellé de rôle", () => {
  it("un particulier reste Adhérent, jamais Bénévole", () =>
    expect(memberRoleLabel({ isBureau: false, isPro: false })).toBe("Adhérent"));
  it("le Bureau prime", () => expect(memberRoleLabel({ isBureau: true, isPro: true })).toBe("Bureau"));
});
