import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_OPTIONS,
  BIO_MAX,
  COLLABORATION_MODES,
  CONTRIBUTION_PREFERENCES,
  initialsOf,
  normalizeSkills,
  SKILLS_MAX,
  VISIBILITY_LABEL,
} from "./profile-details";

const migration = readFileSync("drizzle/migrations/0072_profile_human_field_visibility.sql", "utf8");
const checkList = (column: string) => {
  const m = migration.match(new RegExp(`${column}\\s*<@\\s*ARRAY\\[([^\\]]+)\\]`, "i"));
  if (!m) throw new Error(`liste ${column} introuvable`);
  return [...(m[1] ?? "").matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]).sort();
};
const codes = (opts: [string, string][]) => opts.map(([c]) => c).sort();

describe("profil : valeurs acceptées par la base", () => {
  it("disponibilités = liste de la base", () => expect(codes(AVAILABILITY_OPTIONS)).toEqual(checkList("availability")));
  it("façons de collaborer = présentiel, distance, asynchrone, collectif", () =>
    expect(codes(COLLABORATION_MODES)).toEqual(["ASYNCHRONE", "COLLECTIF", "DISTANCE", "PRESENTIEL"]));
  it("façons de collaborer = liste de la base", () => expect(codes(COLLABORATION_MODES)).toEqual(checkList("collaboration_modes")));
  it("envies d'aider = types de contribution de la base", () => expect(codes(CONTRIBUTION_PREFERENCES)).toEqual(checkList("contribution_types")));
  it("visibilité : seulement membres de l'annuaire ou privé, jamais public", () =>
    expect(Object.keys(VISIBILITY_LABEL).sort()).toEqual(["MEMBERS", "PRIVATE"]));
  it("privé par défaut pour chaque bloc", () => {
    for (const col of ["bio_visibility", "location_visibility", "skills_visibility", "availability_visibility"]) {
      expect(migration).toMatch(new RegExp(`${col} text NOT NULL DEFAULT 'PRIVATE'`));
    }
  });
  it("limites alignées : présentation 600, compétences 30", () => {
    expect(BIO_MAX).toBe(600);
    expect(SKILLS_MAX).toBe(30);
  });
});

describe("normalizeSkills", () => {
  it("retire vides et doublons sans tenir compte de la casse", () =>
    expect(normalizeSkills([" Couture ", "couture", "", "Photo"])).toEqual(["Couture", "Photo"]));
  it("plafonne à 30 éléments de 60 caractères", () => {
    const many = Array.from({ length: 40 }, (_, i) => `c${i}`);
    expect(normalizeSkills(many)).toHaveLength(30);
    expect(normalizeSkills(["x".repeat(80)])[0]).toHaveLength(60);
  });
});

describe("initialsOf", () => {
  it("prénom + nom", () => expect(initialsOf({ first_name: "camille", last_name: "Durand" })).toBe("CD"));
  it("nom affiché si pas de prénom", () => expect(initialsOf({ display_name: "Uma la border" })).toBe("UL"));
  it("point d'interrogation si rien", () => expect(initialsOf({})).toBe("?"));
});
