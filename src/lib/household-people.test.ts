import { describe, expect, it } from "vitest";
import { ageFrom, canSubmitAccountClosure, cleanHouseholdName, householdNameOptions, membersInSeveralHouseholds, personLabel } from "./household-people";

describe("personnes du foyer", () => {
  const today = new Date("2026-10-28T12:00:00");
  it("calcule l'âge à partir de la date de naissance, anniversaire non passé", () => {
    expect(ageFrom("2016-11-05", null, today)).toBe(9);
    expect(ageFrom("2016-10-28", null, today)).toBe(10);
  });
  it("retombe sur l'ancienne année de naissance si la date manque", () => {
    expect(ageFrom(null, 2020, today)).toBe(6);
    expect(ageFrom(null, null, today)).toBeNull();
  });
  it("affiche prénom et nom", () => {
    expect(personLabel({ first_name: "Léa", last_name: "Martin" })).toBe("Léa Martin");
    expect(personLabel({ first_name: "Léa", last_name: null })).toBe("Léa");
  });
  it("repère un membre présent dans deux foyers", () => {
    const dup = membersInSeveralHouseholds([
      { user_id: "a", household_id: "h1" }, { user_id: "a", household_id: "h2" }, { user_id: "b", household_id: "h1" },
    ]);
    expect([...dup]).toEqual(["a"]);
  });
});


describe("nom du foyer", () => {
  it("propose « Mon foyer » en premier, puis « Foyer de Camille »", () => {
    expect(householdNameOptions("Camille")).toEqual(["Mon foyer", "Foyer de Camille"]);
  });
  it("sans prénom, seul le nom neutre est proposé", () => {
    expect(householdNameOptions("  ")).toEqual(["Mon foyer"]);
  });
  it("refuse un nom vide et nettoie les espaces", () => {
    expect(cleanHouseholdName(" ")).toBeNull();
    expect(cleanHouseholdName("  Foyer   des  Pins ")).toBe("Foyer des Pins");
  });
});

describe("clôture d'un compte par le Bureau", () => {
  it("exige un motif et le mot CLÔTURER", () => {
    expect(canSubmitAccountClosure("Départ sans nouvelles", "clôturer")).toBe(true);
    expect(canSubmitAccountClosure("Départ sans nouvelles", "CLOTURER")).toBe(true);
    expect(canSubmitAccountClosure("abc", "CLÔTURER")).toBe(false);
    expect(canSubmitAccountClosure("Départ sans nouvelles", "SUPPRIMER")).toBe(false);
  });
});
