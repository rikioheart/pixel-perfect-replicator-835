/**
 * Contrôle WCAG AA des composants partagés et de leurs états réels, pour les deux signatures,
 * les deux thèmes, avec et sans « Contraste renforcé ». Chaque ligne reprend les classes du composant
 * (ex. bouton survolé = bg-primary/90 posé sur le fond). Les états désactivés sont exemptés par WCAG.
 */
import { describe, expect, it } from "vitest";
import { WITH_CONTRAST, cssBlock, ratio, tokens, type Surface } from "./theme-css.test-helpers";

const TEXT = 4.5; // texte (WCAG 1.4.3)
const UI = 3; // contours de champs, états, anneau de focus, jauges, graphiques (WCAG 1.4.11)

const over = (token: string, alpha: number, base: Surface): Surface => ({ token, alpha, over: base });

type Check = [composant: string, avant: Surface, fond: Surface, minimum: number];

function checks(): Check[] {
  const list: Check[] = [];
  for (const base of ["background", "card"] as const) {
    list.push(
      // Boutons
      ["Bouton principal survolé", "primary-foreground", over("primary", 0.9, base), TEXT],
      ["Bouton danger survolé", "destructive-foreground", over("destructive", 0.9, base), TEXT],
      ["Bouton secondaire survolé", "secondary-foreground", over("secondary", 0.8, base), TEXT],
      ["Bouton lien", "primary-ink", base, TEXT],
      // Badges
      ["Badge principal survolé", "primary-foreground", over("primary", 0.8, base), TEXT],
      ["Badge danger survolé", "destructive-foreground", over("destructive", 0.8, base), TEXT],
      ["Badge secondaire survolé", "secondary-foreground", over("secondary", 0.8, base), TEXT],
      ["Badge d'état « en cours »", "primary-ink", over("primary", 0.1, base), TEXT],
      ["Badge d'état « terminé »", "success", over("success", 0.15, base), TEXT],
      ["Badge d'état « à valider »", "foreground", over("warning", 0.25, base), TEXT],
      ["Badge d'état « bloqué »", "destructive", over("destructive", 0.1, base), TEXT],
      // Champs
      ["Texte saisi", "foreground", base, TEXT],
      ["Texte d'exemple (placeholder)", "muted-foreground", base, TEXT],
      ["Contour de champ", "input", base, UI],
      ["Case à cocher / bouton radio", "primary-ink", base, UI],
      ["Interrupteur inactif (piste)", "muted-foreground", base, UI],
      ["Interrupteur actif (contour)", "primary-ink", base, UI],
      // Messages d'erreur et alertes
      ["Message d'erreur", "destructive", base, TEXT],
      // Notifications
      ["Notification non lue (texte secondaire)", "muted-foreground", over("primary", 0.05, base), TEXT],
      ["Notification non lue (repère)", "primary-ink", base, UI],
      // Jauges
      ["Jauge (remplissage sur sa piste)", "primary-ink", over("primary-ink", 0.2, base), UI],
      // Focus
      ["Anneau de focus", "ring", base, UI],
      // Graphiques
      ...[1, 2, 3, 4, 5].map((n): Check => [`Graphique série ${n}`, `chart-${n}`, base, UI]),
    );
  }
  list.push(
    ["Bouton principal", "primary-foreground", "primary", TEXT],
    ["Bouton danger", "destructive-foreground", "destructive", TEXT],
    ["Bouton secondaire", "secondary-foreground", "secondary", TEXT],
    ["Bouton contour / discret survolé", "accent-foreground", "accent", TEXT],
    ["Carte : texte", "card-foreground", "card", TEXT],
    ["Carte : texte secondaire", "muted-foreground", "card", TEXT],
    ["Zone grisée : texte secondaire", "muted-foreground", "muted", TEXT],
    ["Menu : élément", "popover-foreground", "popover", TEXT],
    ["Menu : élément survolé", "accent-foreground", "accent", TEXT],
    ["Menu : sous-menu ouvert", "popover-foreground", "accent", TEXT],
    ["Infobulle", "primary-foreground", "primary", TEXT],
    ["Onglets : onglet inactif", "muted-foreground", "muted", TEXT],
    ["Onglets : onglet actif", "foreground", "background", TEXT],
    ["Onglets : repère de l'onglet actif", "primary-ink", "background", UI],
    ["Onglets de rubrique : actif", "primary-foreground", "primary", TEXT],
    ["Onglets de rubrique : survolé", "muted-foreground", "muted", TEXT],
    ["Barre d'accès rapide : inactif", "muted-foreground", "card", TEXT],
    ["Menu latéral : lien", "sidebar-foreground", "sidebar", TEXT],
    ["Menu latéral : lien survolé", "sidebar-foreground", "sidebar-accent", TEXT],
    ["Menu latéral : rubrique active", "signature-foreground", "signature-from", TEXT],
    ["Menu latéral : rubrique active (fin du dégradé)", "signature-foreground", "signature-to", TEXT],
    ["Menu latéral : anneau de focus", "sidebar-ring", "sidebar", UI],
    ["Message éphémère : texte", "foreground", "background", TEXT],
    ["Message éphémère : détail", "muted-foreground", "background", TEXT],
    ["Interrupteur actif (pastille)", "primary-foreground", "primary", UI],
    ["Interrupteur inactif (pastille)", "background", "muted-foreground", UI],
    ["Pastille du nombre de notifications", "primary-foreground", "primary", TEXT],
  );
  return list;
}

describe("Composants partagés : contrastes WCAG AA dans chaque état", () => {
  for (const combo of WITH_CONTRAST) {
    it(combo.name, () => {
      const { get } = tokens(combo);
      const failures = checks().flatMap(([name, fg, bg, min]) => {
        const r = ratio(get, fg, bg);
        return r < min ? [`${name} (${JSON.stringify(fg)} sur ${JSON.stringify(bg)}) : ${r.toFixed(2)} < ${min}`] : [];
      });
      expect(failures).toEqual([]);
    });
  }
});

// Contraste renforcé : le texte courant vise 7:1 (niveau AAA) et les contours 4,5:1.
const REINFORCED: Check[] = [
  ["Texte principal", "foreground", "background", 7],
  ["Texte sur carte", "card-foreground", "card", 7],
  ["Texte secondaire", "muted-foreground", "background", 7],
  ["Texte secondaire sur carte", "muted-foreground", "card", 7],
  ["Bouton principal", "primary-foreground", "primary", 7],
  ["Marque en texte", "primary-ink", "background", 7],
  ["Marque en texte sur carte", "primary-ink", "card", 7],
  ["Contour de champ", "input", "card", 4.5],
  ["Séparateurs et bordures", "border", "card", 3],
  ["Anneau de focus", "ring", "card", 4.5],
];

describe("Contraste renforcé : niveau supérieur réellement atteint", () => {
  for (const combo of WITH_CONTRAST.filter((c) => c.highContrast)) {
    it(combo.name, () => {
      const { get } = tokens(combo);
      const failures = REINFORCED.flatMap(([name, fg, bg, min]) => {
        const r = ratio(get, fg, bg);
        return r < min ? [`${name} : ${r.toFixed(2)} < ${min}`] : [];
      });
      expect(failures).toEqual([]);
    });
  }
});

// Les tests fusionnent les blocs dans l'ordre : on vérifie que cet ordre reflète bien la cascade CSS réelle.

describe("Contraste renforcé : cascade CSS fidèle aux tests", () => {
  it("chaque jeton renforcé du thème clair est redéfini pour le thème sombre", () => {
    const light = Object.keys(cssBlock(".prefs-high-contrast"));
    const dark = Object.keys(cssBlock(".dark.prefs-high-contrast"));
    expect(light.filter((name) => !dark.includes(name))).toEqual([]);
  });

  it("la signature Bleu nuit claire ne redéfinit aucun jeton renforcé (elle l'emporterait sinon)", () => {
    const reinforced = Object.keys(cssBlock(".prefs-high-contrast"));
    const bleuNuit = Object.keys(cssBlock(".sig-bleu-nuit:not(.dark)"));
    expect(reinforced.filter((name) => bleuNuit.includes(name))).toEqual([]);
  });
});
