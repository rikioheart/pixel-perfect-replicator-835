import { humanizeError, couldNot } from "@/lib/user-messages";
/**
 * Cycle de vie des tâches (Lot 3). Miroir lisible de la règle de la base
 * (task_validator / guard_task_lifecycle) : l'interface n'est qu'un confort,
 * la base reste la seule frontière.
 */

export const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS", "WAITING", "BLOCKED", "PENDING_VALIDATION"] as const;

/** Statuts qu'une personne non responsable ne peut jamais poser elle-même. */
export const VALIDATOR_ONLY_STATUSES = ["COMPLETED", "ARCHIVED"] as const;

export type TaskActor = {
  userId: string | null | undefined;
  isBureau: boolean;
  /** Coordinateur ou responsable du projet de la tâche. */
  isProjectCoordinator: boolean;
};

export type TaskRef = {
  project_id?: string | null;
  created_by?: string | null;
  assigned_user_id?: string | null;
};

/** Peut valider, renvoyer, rouvrir ou archiver la tâche. */
export function canValidateTask(task: TaskRef, actor: TaskActor): boolean {
  if (!actor.userId) return false;
  if (actor.isBureau) return true;
  if (task.project_id) return actor.isProjectCoordinator;
  return task.created_by === actor.userId && task.assigned_user_id !== actor.userId;
}

/** Statuts proposés dans le formulaire d'édition selon le rôle. */
export function editableStatuses<T extends string>(all: readonly T[], canValidate: boolean): T[] {
  if (canValidate) return [...all];
  return all.filter((s) => !(VALIDATOR_ONLY_STATUSES as readonly string[]).includes(s));
}

/** Tâches encore ouvertes qui doivent être signalées avant de clôturer un projet. */
export function openTasksBeforeClosure<T extends { status: string }>(tasks: T[]): T[] {
  return tasks.filter((t) => (OPEN_TASK_STATUSES as readonly string[]).includes(t.status));
}

/** Rend lisible une erreur de la base, sans jamais la transformer en faux succès. */
export function explainDbError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return couldNot("enregistrer vos changements");
  const msg = error.message ?? "";
  if (error.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Cette modification est réservée à d'autres responsables. Le Bureau ou le coordinateur du projet peut vous aider.";
  }
  if (error.code === "22007" || error.code === "22008" || /invalid input syntax for type date/i.test(msg)) {
    return "La date saisie n'est pas valide.";
  }
  return humanizeError(error, couldNot("enregistrer vos changements"));
}

/** Une mise à jour filtrée par les droits qui ne touche aucune ligne est un refus, pas un succès. */
export const NO_ROW_UPDATED =
  "Ce changement n'a pas pu être pris en compte : la tâche a peut-être été retirée, ou elle relève d'autres responsables.";

/** Chaîne vide → null pour les champs facultatifs (dates, affectation). */
export function emptyToNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}
