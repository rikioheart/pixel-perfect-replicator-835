import { describe, expect, it } from "vitest";
import { BADGES, DESIGN_ONLY_BADGES, earnedBadges, isNewStamp } from "./recognition";
import { taskProgress } from "./archives";
import { milestoneSummary } from "./project-followup";

describe("marques de reconnaissance : seulement sur décision humaine enregistrée", () => {
  it("aucune donnée : aucun badge", () =>
    expect(earnedBadges({ tasksValidatedByOthers: 0, roles: [], membershipStatus: "ACTIVE" })).toEqual([]));
  it("« Premier coup de main » : une tâche confiée validée par une autre personne", () =>
    expect(earnedBadges({ tasksValidatedByOthers: 1, roles: [], membershipStatus: "PENDING" })).toEqual(["PREMIER_COUP_DE_MAIN"]));
  it("« Bienfaiteur actif » : rôle attribué par le Bureau ET adhésion active", () => {
    expect(earnedBadges({ tasksValidatedByOthers: 0, roles: ["MEMBRE_BIENFAITEUR"], membershipStatus: "ACTIVE" })).toEqual(["BIENFAITEUR_ACTIF"]);
    expect(earnedBadges({ tasksValidatedByOthers: 0, roles: ["MEMBRE_BIENFAITEUR"], membershipStatus: "PENDING" })).toEqual([]);
  });
  it("un statut de pro ou de Bureau ne donne pas de badge à lui seul", () =>
    expect(earnedBadges({ tasksValidatedByOthers: 0, roles: ["ADMIN_BUREAU"], membershipStatus: "ACTIVE" })).toEqual([]));
  it("« Pilier du terrain » conçu mais jamais attribué automatiquement", () => {
    expect(DESIGN_ONLY_BADGES.map((b) => b.label)).toContain("Pilier du terrain");
    expect(Object.values(BADGES).map((b) => b.label)).not.toContain("Pilier du terrain");
  });
  it("aucun badge ne parle de rang, de score ou de classement", () => {
    for (const b of Object.values(BADGES)) expect(`${b.label} ${b.message}`).not.toMatch(/meilleur|classement|rang|score|top|points/i);
  });
});

describe("célébration du tampon : compteur serveur uniquement", () => {
  it("première lecture sur l'appareil : pas de célébration", () => expect(isNewStamp(null, 4)).toBe(false));
  it("compteur en hausse : célébration", () => expect(isNewStamp("3", 4)).toBe(true));
  it("compteur identique ou en baisse : rien", () => {
    expect(isNewStamp("4", 4)).toBe(false);
    expect(isNewStamp("5", 4)).toBe(false);
    expect(isNewStamp("abc", 4)).toBe(false);
  });
});

describe("jauges collectives : pas de faux pourcentage", () => {
  it("aucune tâche : pas de pourcentage", () => expect(taskProgress([]).percent).toBeNull());
  it("tâches validées sur tâches comptées, annulées exclues", () =>
    expect(taskProgress([{ status: "COMPLETED" }, { status: "TODO" }, { status: "CANCELLED" }, { status: "IN_PROGRESS" }])).toEqual({ done: 1, counted: 3, percent: 33 }));
  it("une tâche « à valider » n'est pas comptée comme faite", () =>
    expect(taskProgress([{ status: "PENDING_VALIDATION" }]).done).toBe(0));
  it("étapes : franchies sur total, prochaine = la plus proche non franchie", () => {
    const s = milestoneSummary([
      { id: "a", title: "Lancement", due_date: "2026-01-01", done_at: "2026-01-02" },
      { id: "b", title: "Atelier", due_date: "2026-12-01", done_at: null },
      { id: "c", title: "Bilan", due_date: null, done_at: null },
    ]);
    expect(s.done).toBe(1);
    expect(s.total).toBe(3);
    expect(s.next?.title).toBe("Atelier");
  });
});
