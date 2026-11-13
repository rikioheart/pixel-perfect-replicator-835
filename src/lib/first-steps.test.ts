import { describe, expect, it } from "vitest";
import { countOutings, defaultHouseholdName, firstStepsState } from "./first-steps";

const base = { isParticulier: true, membershipStatus: "ACTIVE", dogCount: 0, outingCount: 0, dismissed: false };

describe("parcours « Mon premier chien & sortie »", () => {
  it("s'affiche pour un particulier à l'adhésion active qui n'a encore ni chien ni sortie", () => {
    expect(firstStepsState(base)).toMatchObject({ visible: true, dogDone: false, outingDone: false, doneCount: 0 });
  });

  it("ne s'affiche jamais pour le Bureau ou un professionnel", () => {
    expect(firstStepsState({ ...base, isParticulier: false }).visible).toBe(false);
  });

  it("ne s'affiche pas tant que l'adhésion n'est pas active", () => {
    expect(firstStepsState({ ...base, membershipStatus: "PENDING" }).visible).toBe(false);
  });

  it("reste visible après le premier chien, jusqu'à la première sortie", () => {
    expect(firstStepsState({ ...base, dogCount: 1 })).toMatchObject({ visible: true, dogDone: true, doneCount: 1 });
  });

  it("disparaît quand le chien et la sortie sont faits", () => {
    expect(firstStepsState({ ...base, dogCount: 1, outingCount: 1 }).visible).toBe(false);
  });

  it("respecte le choix « Plus tard »", () => {
    expect(firstStepsState({ ...base, dismissed: true }).visible).toBe(false);
  });

  it("propose un nom de foyer à partir du prénom", () => {
    expect(defaultHouseholdName("Marie")).toBe("Foyer de Marie");
    expect(defaultHouseholdName("  ")).toBe("Mon foyer");
  });

  it("une inscription annulée ou refusée ne compte pas comme première sortie", () => {
    expect(countOutings(["CANCELLED", "ANNULE", "REFUSE"])).toBe(0);
    expect(countOutings(["PENDING", "CANCELLED"])).toBe(1);
  });
});
