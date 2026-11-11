import { describe, expect, it } from "vitest";
import { bureauRevokeBlock, bureauTeamIds, needsBureauRole, showTreasurerShortcut } from "./bureau-team";

describe("fonction exécutive → rôle Bureau", () => {
  it("Président, Secrétaire et Trésorier reçoivent le rôle Bureau s'ils ne l'ont pas", () => {
    for (const f of ["PRESIDENT", "SECRETARY", "TREASURER"]) expect(needsBureauRole(f, ["PARTICULIER"])).toBe(true);
  });
  it("pas de second rôle Bureau s'il est déjà attribué", () => {
    expect(needsBureauRole("TREASURER", ["ADMIN_BUREAU"])).toBe(false);
  });
  it("Bénévole, Fondateur ou représentant n'ouvrent pas le Bureau", () => {
    for (const f of ["VOLUNTEER", "FOUNDER", "REPRESENTANT_PRO"]) expect(needsBureauRole(f, [])).toBe(false);
  });
});

describe("fin de mandat : anti-lockout", () => {
  it("le dernier membre du Bureau garde son rôle", () => {
    expect(bureauRevokeBlock({ bureauCount: 1, isSelf: false })).not.toBeNull();
  });
  it("on ne retire pas son propre rôle Bureau", () => {
    expect(bureauRevokeBlock({ bureauCount: 3, isSelf: true })).not.toBeNull();
  });
  it("retrait possible s'il reste d'autres membres du Bureau", () => {
    expect(bureauRevokeBlock({ bureauCount: 2, isSelf: false })).toBeNull();
  });
});

describe("annuaire : Équipe du Bureau", () => {
  it("réunit rôle Bureau et fonctions exécutives actives, sans les fondateurs", () => {
    const ids = bureauTeamIds(["a"], [
      { user_id: "b", function_type: "TREASURER" },
      { user_id: "c", function_type: "FOUNDER" },
      { user_id: "d", function_type: "PRESIDENT", scope_type: "PROJECT" },
    ]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("raccourci Trésorier", () => {
  it("visible pour un trésorier du Bureau", () => {
    expect(showTreasurerShortcut({ isBureau: true, functionTypes: ["TREASURER"] })).toBe(true);
  });
  it("masqué sans rôle Bureau ou sans fonction Trésorier", () => {
    expect(showTreasurerShortcut({ isBureau: false, functionTypes: ["TREASURER"] })).toBe(false);
    expect(showTreasurerShortcut({ isBureau: true, functionTypes: ["SECRETARY"] })).toBe(false);
  });
});
