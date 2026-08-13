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
  "task.link": "Rattachement d'une tâche",
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
