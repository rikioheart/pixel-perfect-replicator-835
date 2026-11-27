/** Lot 2 : progression unique par étape, par catégorie et pour le projet. Logique pure, testée. */
import { taskProgress } from "./archives";

export type PlanTask = { id: string; status: string; milestone_id: string | null; theme_id: string | null; parent_task_id?: string | null };
export type Progress = { done: number; counted: number; percent: number | null };
export type GroupProgress = Progress & { id: string | null };

/** Chaque tâche compte une seule fois : dans le projet, dans son étape et dans sa catégorie. */
export function progressBreakdown(tasks: PlanTask[], milestoneIds: string[], themeIds: string[]) {
  const unique = [...new Map(tasks.map((t) => [t.id, t])).values()];
  const group = (key: "milestone_id" | "theme_id", ids: string[]): GroupProgress[] => {
    const known = new Set(ids);
    const out: GroupProgress[] = ids.map((id) => ({ id, ...taskProgress(unique.filter((t) => t[key] === id)) }));
    const orphans = unique.filter((t) => !t[key] || !known.has(t[key] as string));
    if (orphans.length) out.push({ id: null, ...taskProgress(orphans) });
    return out;
  };
  return { project: taskProgress(unique), byMilestone: group("milestone_id", milestoneIds), byTheme: group("theme_id", themeIds) };
}

export const MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
export const MILESTONE_STATUS_LABEL: Record<string, string> = { PLANNED: "Prévue", IN_PROGRESS: "En cours", DONE: "Atteinte" };

/** Statuts qu'on peut choisir librement depuis le panneau ; soumission et validation passent par leurs boutons dédiés. */
export const EDITABLE_TASK_STATUSES = ["TODO", "IN_PROGRESS", "WAITING", "BLOCKED"] as const;

/** Copie d'une tâche : repart « à faire », sans preuve, validation ni refus. */
export function taskCopy<T extends { title: string; description: string | null; priority: string; deadline: string | null; project_id: string | null; milestone_id: string | null; theme_id: string | null }>(
  t: T,
  userId: string,
  overrides: Partial<{ milestone_id: string | null; title: string }> = {},
) {
  return {
    title: overrides.title ?? `${t.title} (copie)`,
    description: t.description,
    priority: t.priority,
    deadline: t.deadline,
    project_id: t.project_id,
    milestone_id: overrides.milestone_id !== undefined ? overrides.milestone_id : t.milestone_id,
    theme_id: t.theme_id,
    status: "TODO",
    created_by: userId,
  };
}
