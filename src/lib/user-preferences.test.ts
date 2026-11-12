import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_CLASSES,
  TEXT_SCALES,
  effectiveTextScale,
  preferenceClasses,
  projectsViewFor,
  usesCompactNavigation,
} from "./user-preferences";

describe("Préférences de lecture et de confort", () => {
  it("par défaut, aucune classe n'est posée : l'espace garde son rendu habituel", () => {
    expect(preferenceClasses(DEFAULT_PREFERENCES)).toEqual([]);
  });

  it("la taille du texte va de 100 % à 200 %, et reste bornée", () => {
    expect(TEXT_SCALES.map(([v]) => v)).toEqual([100, 112, 125, 150, 175, 200]);
    expect(effectiveTextScale({ text_scale: 250 })).toBe(200);
    expect(effectiveTextScale({ text_scale: 80 })).toBe(100);
  });

  it("à partir de 125 % la mise en page se replie, à partir de 150 % le menu se range derrière « Menu »", () => {
    expect(preferenceClasses({ ...DEFAULT_PREFERENCES, text_scale: 112 })).toEqual([]);
    expect(preferenceClasses({ ...DEFAULT_PREFERENCES, text_scale: 125 })).toEqual(["prefs-text-large"]);
    expect(preferenceClasses({ ...DEFAULT_PREFERENCES, text_scale: 200 })).toEqual(["prefs-text-large", "prefs-text-xlarge"]);
    expect(usesCompactNavigation({ focus_mode: false, text_scale: 125 })).toBe(false);
    expect(usesCompactNavigation({ focus_mode: false, text_scale: 150 })).toBe(true);
  });

  it("le mode focus range le menu sans rien retirer d'autre", () => {
    expect(usesCompactNavigation({ focus_mode: true, text_scale: 100 })).toBe(true);
    expect(preferenceClasses({ ...DEFAULT_PREFERENCES, focus_mode: true })).toEqual(["prefs-focus"]);
  });

  it("chaque réglage pose sa propre classe, toutes retirées hors de l'espace membre", () => {
    const all = preferenceClasses({
      ...DEFAULT_PREFERENCES,
      signature: "BLEU_NUIT",
      high_contrast: true,
      reduced_motion: true,
      comfortable_spacing: true,
      calm_mode: true,
      focus_mode: true,
      font_family: "LEXEND",
      text_scale: 175,
      line_spacing: "LOOSE",
      letter_spacing: "WIDER",
      paragraph_spacing: "WIDE",
      reading_width: "NARROW",
    });
    expect(all).toHaveLength(13);
    for (const name of all) expect(PREFERENCE_CLASSES).toContain(name);
    expect(preferenceClasses({ ...DEFAULT_PREFERENCES, font_family: "ATKINSON" })).toEqual(["prefs-font-atkinson"]);
  });

  it("la page Projets s'ouvre sur la vue choisie, Liste sinon", () => {
    expect(projectsViewFor("KANBAN")).toBe("KANBAN");
    expect(projectsViewFor("CARDS")).toBe("CARDS");
    expect(projectsViewFor("LIST")).toBe("LIST");
    expect(projectsViewFor(undefined)).toBe("LIST");
  });
});
