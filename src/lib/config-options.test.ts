import { describe, expect, it } from "vitest";
import { CONFIG_CATEGORIES, CONFIG_FAMILIES } from "./config-options";

describe("catégories de la page Paramétrage", () => {
  it("propose les quatre catégories demandées", () => {
    expect(CONFIG_CATEGORIES.map((c) => c.label)).toEqual([
      "Gouvernance & Membres",
      "Projets & Actions",
      "Événements & Activités",
      "Documents & Médias",
    ]);
  });

  it("range chaque famille dans une seule catégorie, sans en oublier", () => {
    const placed = CONFIG_CATEGORIES.flatMap((c) => c.families);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(CONFIG_FAMILIES.map((f) => f.family).sort());
  });
});
