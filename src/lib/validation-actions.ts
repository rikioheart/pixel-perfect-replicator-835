import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/mindmap-actions";

export const VALIDATION_COMMENT_MIN = 5;

export type ValidationDecision = "APPROVED" | "REJECTED";

/**
 * Valide ou renvoie une tâche soumise. Le commentaire est obligatoire dans les
 * deux cas : il documente la décision et alimente l'historique.
 */
export async function decideTaskValidation(params: {
  taskId: string;
  taskTitle?: string | null;
  decision: ValidationDecision;
  comment: string;
  actorId: string | null;
}) {
  const comment = params.comment.trim();
  if (comment.length < VALIDATION_COMMENT_MIN) {
    throw new Error("Un commentaire d'au moins 5 caractères est obligatoire.");
  }
  if (!params.actorId) {
    throw new Error("Session expirée, reconnectez-vous.");
  }

  const approve = params.decision === "APPROVED";
  const now = new Date().toISOString();

  const { data: previous } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("id", params.taskId)
    .maybeSingle();

  const { error } = await supabase
    .from("tasks")
    .update(
      approve
        ? {
            status: "COMPLETED",
            completed_at: now,
            validated_at: now,
            validated_by: params.actorId,
            rejection_reason: null,
          }
        : { status: "IN_PROGRESS", rejection_reason: comment },
    )
    .eq("id", params.taskId);
  if (error) throw new Error(error.message);

  await supabase.from("task_validation").insert({
    task_id: params.taskId,
    validated_by: params.actorId,
    status: params.decision,
    comment,
  });

  await supabase.from("task_history").insert({
    task_id: params.taskId,
    user_id: params.actorId,
    action: approve ? "TASK_VALIDATED" : "TASK_RETURNED",
    old_value: { status: previous?.status ?? "PENDING_VALIDATION" } as never,
    new_value: { status: approve ? "COMPLETED" : "IN_PROGRESS", comment } as never,
  });

  await logAudit({
    actorId: params.actorId,
    action: approve ? "TASK_VALIDATED" : "TASK_RETURNED",
    entityType: "task",
    entityId: params.taskId,
    oldValues: { status: previous?.status ?? "PENDING_VALIDATION" },
    newValues: { status: approve ? "COMPLETED" : "IN_PROGRESS" },
    metadata: {
      comment,
      task_title: params.taskTitle ?? previous?.title ?? null,
      source: "cockpit",
    },
  });

  return { approve, comment };
}
