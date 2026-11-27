import { describe, expect, it } from "vitest";
import { directoryQualityMatches, professionalRequestProblem } from "./professional-quality";

describe("demande professionnelle", () => {
  it("demande une structure", () => expect(professionalRequestProblem("", "Éducation", "")).not.toBeNull());
  it("demande une activité", () => expect(professionalRequestProblem("Truffe", "", "")).not.toBeNull());
  it("le SIRET est facultatif et, si rempli, comporte 14 chiffres", () => {
    expect(professionalRequestProblem("Truffe", "Éducation", "")).toBeNull();
    expect(professionalRequestProblem("Truffe", "Éducation", "123")).not.toBeNull();
    expect(professionalRequestProblem("Truffe", "Éducation", "123 456 789 00012")).toBeNull();
  });
});

describe("cumul particulier et professionnel", () => {
  it("un particulier pro validé apparaît dans les deux vues sans changer d’adhésion", () => {
    expect(directoryQualityMatches("PRO", "PARTICULIER", true)).toBe(true);
    expect(directoryQualityMatches("PARTICULIER", "PARTICULIER", true)).toBe(true);
  });
  it("une demande non validée ne figure pas parmi les professionnels", () => {
    expect(directoryQualityMatches("PRO", "PARTICULIER", false)).toBe(false);
    expect(directoryQualityMatches("PRO", "PROFESSIONNEL", false)).toBe(false);
  });
});