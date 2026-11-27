import { describe, expect, it } from "vitest";
import { progressBreakdown, taskCopy } from "./project-plan";

const t = (id: string, status: string, milestone_id: string | null, theme_id: string | null = null) => ({ id, status, milestone_id, theme_id });

describe("progression du projet", () => {
  it("compte chaque tâche une seule fois, même si elle apparaît deux fois", () => {
    const r = progressBreakdown([t("1", "VALIDATED", "m1"), t("1", "VALIDATED", "m1"), t("2", "TODO", "m1")], ["m1"], []);
    expect(r.project).toEqual({ done: 1, counted: 2, percent: 50 });
  });
  it("calcule par étape et regroupe les tâches sans étape", () => {
    const r = progressBreakdown([t("1", "COMPLETED", "m1"), t("2", "TODO", "m2"), t("3", "VALIDATED", null)], ["m1", "m2"], []);
    expect(r.byMilestone).toEqual([
      { id: "m1", done: 1, counted: 1, percent: 100 },
      { id: "m2", done: 0, counted: 1, percent: 0 },
      { id: null, done: 1, counted: 1, percent: 100 },
    ]);
  });
  it("exclut les tâches annulées du calcul par catégorie", () => {
    const r = progressBreakdown([t("1", "CANCELLED", null, "c1"), t("2", "VALIDATED", null, "c1")], [], ["c1"]);
    expect(r.byTheme[0]).toEqual({ id: "c1", done: 1, counted: 1, percent: 100 });
  });
  it("la somme des étapes égale le total du projet", () => {
    const r = progressBreakdown([t("1", "VALIDATED", "m1"), t("2", "TODO", null), t("3", "TODO", "m1")], ["m1"], []);
    expect(r.byMilestone.reduce((s, g) => s + g.counted, 0)).toBe(r.project.counted);
  });
});

describe("duplication de tâche", () => {
  it("repart à faire et garde étape et catégorie", () => {
    const c = taskCopy({ title: "Affiches", description: null, priority: "HIGH", deadline: null, project_id: "p", milestone_id: "m", theme_id: "c" }, "u");
    expect(c).toMatchObject({ title: "Affiches (copie)", status: "TODO", milestone_id: "m", theme_id: "c", created_by: "u" });
  });
});
