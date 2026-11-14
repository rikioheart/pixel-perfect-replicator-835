import { describe, expect, it } from "vitest";
import { defaultHouseholdName, firstStepsState } from "./first-steps";

const base = { isParticulier: true, membershipStatus: "ACTIVE", dogCount: 0, dismissed: false };

describe("parcours « Mon premier chien »", () => {
  it("s'affiche pour un particulier à l'adhésion active qui n'a pas encore de chien", () => {
    expect(firstStepsState(base)).toMatchObject({ visible: true, dogDone: false, doneCount: 0, total: 1 });
  });

  it("ne s'affiche jamais pour le Bureau ou un professionnel", () => {
    expect(firstStepsState({ ...base, isParticulier: false }).visible).toBe(false);
  });

  it("ne s'affiche pas tant que l'adhésion n'est pas active", () => {
    expect(firstStepsState({ ...base, membershipStatus: "PENDING" }).visible).toBe(false);
  });

  it("disparaît dès que le premier chien est enregistré", () => {
    expect(firstStepsState({ ...base, dogCount: 1 })).toMatchObject({ visible: false, dogDone: true, doneCount: 1 });
  });

  it("respecte le choix « Plus tard »", () => {
    expect(firstStepsState({ ...base, dismissed: true }).visible).toBe(false);
  });

  it("propose un nom de foyer à partir du prénom", () => {
    expect(defaultHouseholdName("Marie")).toBe("Foyer de Marie");
    expect(defaultHouseholdName("  ")).toBe("Mon foyer");
  });
});
