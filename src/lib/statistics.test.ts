import { describe, expect, it } from "vitest";
import { bilanCsv, periodPresets, statSections, type BureauStats } from "./statistics";

const stats: BureauStats = {
  members: { particuliers_actifs: 2, pros_bienfaiteurs: 3, en_attente: 1, nouveaux: 4 },
  life: { activites: 5, evenements: 1, inscriptions: 9, presences_validees: 7, participants_uniques: 6 },
  projects: { en_cours: 2, en_preparation: 1, en_pause: 0, termines: 1, crees: 2, avancement_moyen: 40, taches_realisees: 8, taches_ouvertes: 3, taches_en_retard: 1 },
  volunteers: { benevoles_engages: 4, propositions: 2, propositions_acceptees: 1, demandes_aide: 1, taches_benevoles_realisees: 2 },
  pass: { tampons: 12, beneficiaires: 5, cartes: 6, automatiques: 4, par_partenaire: [{ name: "=Cabinet", source: "PRO", tampons: 8, personnes: 4 }] },
  series: [],
};

describe("statistiques stratégiques", () => {
  it("regroupe les chiffres en cinq thèmes", () => {
    expect(statSections(stats).map((s) => s.title)).toEqual([
      "Membres & réseau",
      "Activités & événements",
      "Projets & tâches",
      "Engagement bénévole",
      "Pass Terrain & fidélité",
    ]);
  });

  it("parle de professionnels bienfaiteurs", () => {
    const rows = statSections(stats)[0]!.rows;
    expect(rows).toContainEqual(["Professionnels bienfaiteurs actifs", 3]);
  });

  it("l'exercice en cours couvre l'année civile", () => {
    const current = periodPresets(new Date(2026, 10, 9))[0];
    expect([current.from, current.to]).toEqual(["2026-01-01", "2026-12-31"]);
  });

  it("le bilan exporté inclut le Pass par partenaire sans formule de tableur", () => {
    const csv = bilanCsv(stats, "2026-01-01", "2026-12-31");
    expect(csv).toContain("'=Cabinet;8;4");
    expect(csv).toContain("Professionnels bienfaiteurs actifs;3");
  });
});
