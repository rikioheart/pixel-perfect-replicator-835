import { describe, expect, it } from "vitest";
import { defaultHouseholdName, firstStepsState } from "./first-steps";

const base = { isParticulier: true, membershipStatus: "ACTIVE", dogCount: 0, dismissed: false };

describe("parcours « Mon premier chien »", () => {
  it("s'affiche en entier pour un particulier à l'adhésion active qui n'a pas encore de chien", () => {
    expect(firstStepsState(base)).toEqual({ display: "full", visible: true, dogDone: false });
  });

  it("ne s'affiche jamais pour le Bureau ou un professionnel", () => {
    expect(firstStepsState({ ...base, isParticulier: false }).display).toBe("hidden");
  });

  it("ne s'affiche pas tant que l'adhésion n'est pas active", () => {
    expect(firstStepsState({ ...base, membershipStatus: "PENDING" }).display).toBe("hidden");
  });

  it("disparaît dès que le premier chien est enregistré", () => {
    expect(firstStepsState({ ...base, dogCount: 1 })).toEqual({ display: "hidden", visible: false, dogDone: true });
  });

  it("disparaît après le premier chien même si « Plus tard » avait été choisi", () => {
    expect(firstStepsState({ ...base, dogCount: 1, dismissed: true }).display).toBe("hidden");
  });

  it("reste accessible sous forme de rappel après « Plus tard »", () => {
    expect(firstStepsState({ ...base, dismissed: true })).toEqual({ display: "reminder", visible: true, dogDone: false });
  });

  it("propose un nom de foyer à partir du prénom", () => {
    expect(defaultHouseholdName("Marie")).toBe("Foyer de Marie");
    expect(defaultHouseholdName("  ")).toBe("Mon foyer");
  });
});
