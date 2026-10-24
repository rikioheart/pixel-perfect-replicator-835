import { describe, expect, it } from "vitest";
import {
  canValidateTask,
  editableStatuses,
  emptyToNull,
  explainDbError,
  openTasksBeforeClosure,
} from "./task-lifecycle";
import { TASK_STATUSES } from "./domain";
import { operationalProgress } from "./archives";

const me = "u-me";
const other = "u-other";
const member = { userId: me, isBureau: false, isProjectCoordinator: false };

describe("validation d'une tâche", () => {
  it("le contributeur assigné ne valide pas sa propre tâche de projet", () => {
    expect(canValidateTask({ project_id: "p1", assigned_user_id: me, created_by: me }, member)).toBe(false);
  });
  it("le coordinateur du projet valide", () => {
    expect(canValidateTask({ project_id: "p1", assigned_user_id: other }, { ...member, isProjectCoordinator: true })).toBe(true);
  });
  it("le Bureau valide", () => {
    expect(canValidateTask({ project_id: "p1" }, { ...member, isBureau: true })).toBe(true);
  });
  it("hors projet, le créateur valide la tâche confiée à quelqu'un d'autre", () => {
    expect(canValidateTask({ project_id: null, created_by: me, assigned_user_id: other }, member)).toBe(true);
  });
  it("hors projet, on ne valide pas une tâche qu'on s'est confiée", () => {
    expect(canValidateTask({ project_id: null, created_by: me, assigned_user_id: me }, member)).toBe(false);
  });
  it("sans session, personne ne valide", () => {
    expect(canValidateTask({ project_id: "p1" }, { userId: null, isBureau: true, isProjectCoordinator: true })).toBe(false);
  });
});

describe("statuts proposés à l'édition", () => {
  it("un contributeur ne peut pas choisir Terminée ni Archivée", () => {
    const s = editableStatuses(TASK_STATUSES, false);
    expect(s).not.toContain("COMPLETED");
    expect(s).not.toContain("ARCHIVED");
    expect(s).toContain("PENDING_VALIDATION");
  });
  it("le responsable garde tous les statuts", () => {
    expect(editableStatuses(TASK_STATUSES, true)).toContain("COMPLETED");
  });
});

describe("clôture de projet", () => {
  it("signale les tâches à faire, en cours et à valider", () => {
    const open = openTasksBeforeClosure([
      { status: "TODO" },
      { status: "IN_PROGRESS" },
      { status: "PENDING_VALIDATION" },
      { status: "COMPLETED" },
      { status: "CANCELLED" },
    ]);
    expect(open.map((t) => t.status)).toEqual(["TODO", "IN_PROGRESS", "PENDING_VALIDATION"]);
  });
  it("aucune alerte quand tout est terminé ou annulé", () => {
    expect(openTasksBeforeClosure([{ status: "COMPLETED" }, { status: "CANCELLED" }])).toHaveLength(0);
  });
});

describe("sauvegarde", () => {
  it("une date vide part en null", () => expect(emptyToNull("")).toBeNull());
  it("une date saisie est conservée", () => expect(emptyToNull("2026-11-02")).toBe("2026-11-02"));
  it("un refus de droits est expliqué clairement", () => {
    expect(explainDbError({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Vous n'avez pas le droit de faire cette modification.",
    );
  });
  it("le message métier de la base est conservé", () => {
    expect(explainDbError({ message: "Seul le coordinateur du projet ou le Bureau peut valider cette tâche." })).toContain(
      "coordinateur",
    );
  });
});

describe("avancement opérationnel (Lot 3)", () => {
  it("chaque sous-tâche compte pour une tâche", () => {
    expect(operationalProgress([{ status: "COMPLETED" }, { status: "COMPLETED" }, { status: "TODO" }, { status: "IN_PROGRESS" }])).toBe(50);
  });
  it("une tâche à valider n'est pas encore comptée comme faite", () => {
    expect(operationalProgress([{ status: "PENDING_VALIDATION" }, { status: "COMPLETED" }])).toBe(50);
  });
  it("annulées et archivées sont exclues", () => {
    expect(operationalProgress([{ status: "COMPLETED" }, { status: "CANCELLED" }, { status: "ARCHIVED" }])).toBe(100);
  });
  it("projet sans tâche éligible : pas de pourcentage", () => {
    expect(operationalProgress([{ status: "CANCELLED" }])).toBeNull();
  });
});
