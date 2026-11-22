import { describe, expect, it } from "vitest";
import { availableQualities, filterMembers, normalizeQualities, type MemberOption } from "./member-picker";

const members: MemberOption[] = [
  { id: "1", name: "Marie Berrier", company: null, qualities: ["BUREAU", "PARTICULIER"] },
  { id: "2", name: "Paul Éducateur", company: "Truffe & Co", qualities: ["PRO", "REPRESENTANT", "BUREAU"] },
  { id: "3", name: "Camille Essai", company: null, qualities: ["PARTICULIER", "BENEVOLE"] },
];

describe("sélecteur de membres multi-qualités", () => {
  it("une personne qui cumule pro et Bureau apparaît dans les deux filtres", () => {
    expect(filterMembers(members, ["PRO"], "").map((m) => m.id)).toEqual(["2"]);
    expect(filterMembers(members, ["BUREAU"], "").map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("plusieurs filtres se combinent (au moins une qualité choisie)", () => {
    expect(filterMembers(members, ["BENEVOLE", "REPRESENTANT"], "").map((m) => m.id)).toEqual(["2", "3"]);
  });

  it("sans filtre, tout le monde ; la recherche porte aussi sur la structure, sans accents", () => {
    expect(filterMembers(members, [], "").length).toBe(3);
    expect(filterMembers(members, [], "truffe").map((m) => m.id)).toEqual(["2"]);
    expect(filterMembers(members, [], "educateur").map((m) => m.id)).toEqual(["2"]);
  });

  it("ignore les qualités inconnues et n'affiche que les filtres utiles", () => {
    expect(normalizeQualities(["PRO", "INCONNU", "BUREAU"])).toEqual(["BUREAU", "PRO"]);
    expect(availableQualities(members)).not.toContain("PARTENAIRE");
  });
});
