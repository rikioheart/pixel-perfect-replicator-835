import { describe, expect, it } from "vitest";
import { defaultGrantsFor, defaultState } from "./permission-defaults";

describe("droits par défaut des rôles système", () => {
  it("le Bureau détient tous les droits", () => {
    expect(defaultGrantsFor("ADMIN_BUREAU")).toBeNull();
    expect(defaultState("ADMIN_BUREAU", "finance.validate")).toBe("granted");
  });

  it("les droits pro du Bienfaiteur ne valent que pour un pro validé", () => {
    expect(defaultState("MEMBRE_BIENFAITEUR", "loyalty.stamp")).toBe("pro");
    expect(defaultState("MEMBRE_BIENFAITEUR", "activities.create")).toBe("pro");
    expect(defaultState("MEMBRE_BIENFAITEUR", "members.view")).toBe("pro");
  });

  it("seul le Bureau modifie la mindmap", () => {
    for (const role of ["MEMBRE_FONDATEUR", "MEMBRE_BIENFAITEUR", "MEMBRE_APPRENANT", "MEMBRE_SOUTIEN", "PARTICULIER", "REPRESENTANT_PARTICULIERS"]) {
      expect(defaultState(role, "mindmap.edit")).toBe("none");
    }
  });

  it("un particulier ne voit pas l'annuaire des membres et ne tamponne pas", () => {
    expect(defaultState("PARTICULIER", "members.view")).toBe("none");
    expect(defaultState("PARTICULIER", "loyalty.stamp")).toBe("none");
  });

  it("aucun rôle hors Bureau n'a de droit financier global", () => {
    for (const role of ["MEMBRE_FONDATEUR", "MEMBRE_BIENFAITEUR", "PARTICULIER", "REPRESENTANT_PARTICULIERS"]) {
      expect(defaultState(role, "finance.view_global")).toBe("none");
      expect(defaultState(role, "reimbursements.validate")).toBe("none");
    }
  });

  it("les anciens rôles retirés n'ont plus de droits par défaut", () => {
    expect(defaultGrantsFor("PROFESSIONNEL")).toEqual([]);
    expect(defaultGrantsFor("REPRESENTANT_PROFESSIONNELS")).toEqual([]);
  });
});
