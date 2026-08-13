import { supabase } from "@/integrations/supabase/client";

export type AuditEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "project.create": "Création du projet",
  "project.update": "Modification du projet",
  "project.delete": "Suppression du projet",
  "project.link": "Rattachement du projet",
  "task.create": "Création d'une tâche",
  "task.update": "Modification d'une tâche",
  "task.link": "Rattachement d'une tâche",
  "project.create.undo": "Création de projet annulée",
  "project.update.undo": "Modification de projet annulée",
  "project.delete.undo": "Suppression de projet annulée",
  "project.link.undo": "Rattachement de projet annulé",
  "task.create.undo": "Création de tâche annulée",
  "task.link.undo": "Rattachement de tâche annulé",
};


export async function logAudit(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (!params.actorId) return;
  await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    old_values: (params.oldValues ?? null) as never,
    new_values: (params.newValues ?? null) as never,
    metadata: (params.metadata ?? null) as never,
  });
}

export async function fetchProjectAudit(projectId: string): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
    .eq("entity_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as AuditEntry[];
}

export type ProjectEditValues = {
  title: string;
  description: string;
  status: string;
  priority: string;
  category_id: string | null;
  deadline: string | null;
  owner_id: string | null;
  progress_percent: number;
};

export function validateProjectEdit(values: ProjectEditValues) {
  const errors: Partial<Record<keyof ProjectEditValues, string>> = {};
  if (!values.title.trim()) errors.title = "Le titre est obligatoire.";
  else if (values.title.trim().length < 3) errors.title = "Au moins 3 caractères.";
  if (
    Number.isNaN(values.progress_percent) ||
    values.progress_percent < 0 ||
    values.progress_percent > 100
  )
    errors.progress_percent = "L'avancement doit être compris entre 0 et 100.";
  if (values.deadline && Number.isNaN(new Date(values.deadline).getTime()))
    errors.deadline = "Date invalide.";
  return errors;
}

/* ------------------------------------------------------------------ */
/* Historique consolidé projet + tâches                                */
/* ------------------------------------------------------------------ */

export type HistoryEntry = {
  id: string;
  scope: "project" | "task";
  label: string;
  summary: string | null;
  actorId: string | null;
  at: string;
};

export async function fetchProjectHistory(projectId: string): Promise<HistoryEntry[]> {
  const { data: taskRows } = await supabase
    .from("tasks")
    .select(
      "id,title,status,created_at,updated_at,submitted_at,completed_at,validated_at,created_by,assigned_user_id,validated_by,rejection_reason",
    )
    .eq("project_id", projectId);

  const tasks = taskRows ?? [];
  const ids = [projectId, ...tasks.map((t) => t.id)];

  const { data: auditRows } = await supabase
    .from("audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
    .in("entity_id", ids)
    .order("created_at", { ascending: false })
    .limit(100);

  const entries: HistoryEntry[] = (auditRows ?? []).map((entry) => {
    const metadata = (entry.metadata ?? null) as Record<string, unknown> | null;
    const summary = typeof metadata?.['summary'] === "string" ? (metadata['summary'] as string) : null;
    return {
      id: entry.id,
      scope: entry.action.startsWith("task") ? "task" : "project",
      label: AUDIT_ACTION_LABEL[entry.action] ?? entry.action,
      summary,
      actorId: entry.actor_id,
      at: entry.created_at,
    };
  });

  for (const task of tasks) {
    entries.push({
      id: `${task.id}-created`,
      scope: "task",
      label: "Tâche créée",
      summary: `« ${task.title} » ajoutée au projet`,
      actorId: task.created_by,
      at: task.created_at,
    });
    if (task.submitted_at)
      entries.push({
        id: `${task.id}-submitted`,
        scope: "task",
        label: "Tâche soumise à validation",
        summary: `« ${task.title} » marquée comme terminée par le membre`,
        actorId: task.assigned_user_id,
        at: task.submitted_at,
      });
    if (task.validated_at)
      entries.push({
        id: `${task.id}-validated`,
        scope: "task",
        label: task.status === "COMPLETED" ? "Tâche validée" : "Tâche renvoyée",
        summary:
          task.status === "COMPLETED"
            ? `« ${task.title} » validée par le Bureau`
            : `« ${task.title} » refusée : ${task.rejection_reason ?? "complément demandé"}`,
        actorId: task.validated_by,
        at: task.validated_at,
      });
    else if (task.completed_at)
      entries.push({
        id: `${task.id}-completed`,
        scope: "task",
        label: "Tâche terminée",
        summary: `« ${task.title} » passée en terminée`,
        actorId: task.assigned_user_id,
        at: task.completed_at,
      });
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 80);
}

/* ------------------------------------------------------------------ */
/* Annulation de la dernière action                                    */
/* ------------------------------------------------------------------ */

export type UndoableAction =
  | { type: "project.create"; label: string; projectId: string }
  | { type: "task.create"; label: string; taskId: string }
  | {
      type: "project.update";
      label: string;
      projectId: string;
      previous: Record<string, unknown>;
    }
  | { type: "project.delete"; label: string; row: Record<string, unknown> }
  | {
      type: "project.link";
      label: string;
      projectId: string;
      previousParentId: string | null;
    }
  | { type: "task.link"; label: string; taskId: string; previousProjectId: string | null };

/** La restauration d'une suppression ou d'un lien est réservée au Bureau. */
export function canUndo(action: UndoableAction, isBureau: boolean) {
  if (isBureau) return true;
  return action.type === "project.create" || action.type === "task.create";
}

export async function undoAction(
  action: UndoableAction,
  actorId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const log = (entityId: string, summary: string) =>
    logAudit({
      actorId,
      action: `${action.type}.undo`,
      entityType: "project",
      entityId,
      metadata: { summary },
    });

  if (action.type === "project.create") {
    const { error } = await supabase.from("projects").delete().eq("id", action.projectId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (action.type === "task.create") {
    const { data: task } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("id", action.taskId)
      .maybeSingle();
    const { error } = await supabase.from("tasks").delete().eq("id", action.taskId);
    if (error) return { ok: false, error: error.message };
    if (task?.project_id) await log(task.project_id, `Annulation : ${action.label}`);
    return { ok: true };
  }

  if (action.type === "project.update") {
    const { error } = await supabase
      .from("projects")
      .update(action.previous as never)
      .eq("id", action.projectId);
    if (error) return { ok: false, error: error.message };
    await log(action.projectId, `Annulation : ${action.label}`);
    return { ok: true };
  }

  if (action.type === "project.delete") {
    const { error } = await supabase.from("projects").insert(action.row as never);
    if (error) return { ok: false, error: error.message };
    await log(String(action.row['id']), `Annulation : ${action.label}`);
    return { ok: true };
  }

  if (action.type === "project.link") {
    const { error } = await supabase
      .from("projects")
      .update({ parent_project_id: action.previousParentId })
      .eq("id", action.projectId);
    if (error) return { ok: false, error: error.message };
    await log(action.projectId, `Annulation : ${action.label}`);
    return { ok: true };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ project_id: action.previousProjectId })
    .eq("id", action.taskId);
  if (error) return { ok: false, error: error.message };
  await log(action.previousProjectId ?? action.taskId, `Annulation : ${action.label}`);
  return { ok: true };
}
