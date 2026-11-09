import { describe, expect, it } from "vitest";
import { filterByName } from "./name-search";

const people = [
  { id: "1", name: "Marie Camus" },
  { id: "2", name: "Élodie Martin" },
  { id: "3", name: "Lucas Membre" },
];

describe("recherche d'un bénéficiaire par nom et prénom", () => {
  it("trouve par prénom puis nom, ou nom puis prénom", () => {
    expect(filterByName(people, "marie camus").map((p) => p.id)).toEqual(["1"]);
    expect(filterByName(people, "camus mar").map((p) => p.id)).toEqual(["1"]);
  });

  it("ignore les accents et la casse", () => {
    expect(filterByName(people, "ELODIE").map((p) => p.id)).toEqual(["2"]);
  });

  it("une recherche vide garde toute la liste", () => {
    expect(filterByName(people, "  ")).toHaveLength(3);
  });

  it("aucun résultat si un mot ne correspond pas", () => {
    expect(filterByName(people, "marie dupont")).toHaveLength(0);
  });
});
