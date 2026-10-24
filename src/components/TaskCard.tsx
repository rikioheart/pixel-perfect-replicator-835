import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfigOptions } from "@/lib/config-options";
import { TASK_STATUS_LABEL, PRIORITY_LABEL, formatDate } from "@/lib/domain";
import { explainDbError, NO_ROW_UPDATED } from "@/lib/task-lifecycle";
import { decideTaskValidation, VALIDATION_COMMENT_MIN } from "@/lib/validation-actions";
import { Comments } from "@/components/Comments";
import { ExternalLinks } from "@/components/ExternalLinks";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  assigned_user_id: string | null;
  rejection_reason: string | null;
  project_id?: string | null;
  created_by?: string | null;
  projects?: { title: string } | null;
};

export function TaskCard({
  task,
  currentUserId,
  isBureau,
  canValidate = isBureau,
  onChanged,
  showProject = true,
}: {
  task: TaskRow;
  currentUserId: string;
  isBureau: boolean;
  /** Coordinateur du projet ou Bureau : peut valider, renvoyer ou rouvrir. */
  canValidate?: boolean;
  onChanged: () => void;
  showProject?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofType, setProofType] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [busy, setBusy] = useState(false);
  const proofTypes = useConfigOptions("PROOF_TYPE");

  const isMine = task.assigned_user_id === currentUserId;
  const canAct = isMine || isBureau;
  const awaitingDecision = task.status === "PENDING_VALIDATION" && canValidate;

  const { data: lastSubmission } = useQuery({
    queryKey: ["task-submission", task.id],
    enabled: awaitingDecision,
    queryFn: async () =>
      (
        await supabase
          .from("task_submissions")
          .select("comment, proof_url, submitted_at")
          .eq("task_id", task.id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  // Chaque type de preuve déclare les statuts de tâche auxquels il s'applique.
  const allowedProofs = proofTypes.options.filter((option) => {
    const statuses = option.metadata?.task_statuses;
    return !statuses || statuses.length === 0 || statuses.includes(task.status);
  });
  const selectedProof = allowedProofs.find((option) => option.code === proofType);
  const requiresFile = Boolean(selectedProof?.metadata?.requires_file);

  const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase
      .from("tasks")
      .update({ status, ...extra })
      .eq("id", task.id)
      .select("id");
    if (error) {
      toast.error(explainDbError(error));
      return false;
    }
    if (!data || data.length === 0) {
      toast.error(NO_ROW_UPDATED);
      return false;
    }
    onChanged();
    return true;
  };

  const submitForValidation = async () => {
    if (requiresFile && !/^https?:\/\//.test(proofUrl.trim())) {
      toast.error(`Le type « ${selectedProof?.label} » demande un lien vers la pièce jointe.`);
      return;
    }
    setBusy(true);
    try {
      if (comment.trim() || proofUrl.trim()) {
        const { error } = await supabase.from("task_submissions").insert({
          task_id: task.id,
          submitted_by: currentUserId,
          comment: comment.trim() || null,
          proof_url: proofUrl.trim() || null,
          proof_type: proofType || null,
        });
        if (error) {
          toast.error(explainDbError(error));
          return;
        }
      }
      if (await setStatus("PENDING_VALIDATION")) {
        toast.success("Tâche envoyée pour validation.");
        setSubmitting(false);
        setComment("");
        setProofUrl("");
        setProofType("");
      }
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      await decideTaskValidation({
        taskId: task.id,
        taskTitle: task.title,
        decision,
        comment: decisionComment,
        actorId: currentUserId || null,
      });
      toast.success(decision === "APPROVED" ? "Tâche validée." : "Tâche renvoyée avec votre commentaire.");
      setDecisionComment("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Décision impossible.");
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      if (await setStatus("IN_PROGRESS")) {
        await supabase.from("task_history").insert({
          task_id: task.id,
          user_id: currentUserId,
          action: "TASK_REOPENED",
          old_value: { status: task.status } as never,
          new_value: { status: "IN_PROGRESS" } as never,
        });
        toast.success("Tâche rouverte.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            {showProject ? `${task.projects?.title ?? "Hors projet"} · ` : ""}
            {PRIORITY_LABEL[task.priority] ?? task.priority} · {formatDate(task.deadline)}
          </p>
        </div>
        <Badge variant="outline">{TASK_STATUS_LABEL[task.status] ?? task.status}</Badge>
      </div>

      {task.description ? (
        <p className="text-sm text-muted-foreground">{task.description}</p>
      ) : null}

      {task.rejection_reason && task.status !== "COMPLETED" ? (
        <p className="rounded-md bg-muted p-2 text-xs">Retour du responsable : {task.rejection_reason}</p>
      ) : null}

      {canAct ? (
        <div className="flex flex-wrap gap-2">
          {task.status === "TODO" ? (
            <Button size="sm" variant="secondary" onClick={() => setStatus("IN_PROGRESS", { started_at: new Date().toISOString() })}>
              Démarrer
            </Button>
          ) : null}
          {["TODO", "IN_PROGRESS", "WAITING", "BLOCKED"].includes(task.status) ? (
            <>
              <Button size="sm" onClick={() => setSubmitting((value) => !value)} aria-expanded={submitting}>
                Soumettre pour validation
              </Button>
              {task.status !== "BLOCKED" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus("BLOCKED")}>
                  Signaler un blocage
                </Button>
              ) : null}
            </>
          ) : null}
          {task.status === "PENDING_VALIDATION" && !canValidate ? (
            <p className="text-xs text-muted-foreground">En attente de la validation du responsable du projet ou du Bureau.</p>
          ) : null}
        </div>
      ) : null}

      {submitting ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Un mot ou un lien aide le responsable à valider, mais ce n'est pas obligatoire.
          </p>
          <Textarea
            rows={2}
            aria-label="Ce qui a été fait"
            placeholder="Ce qui a été fait (facultatif)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {allowedProofs.length > 0 ? (
            <select
              aria-label="Type de preuve"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={proofType}
              onChange={(e) => setProofType(e.target.value)}
            >
              <option value="">Type de preuve (facultatif)</option>
              {allowedProofs.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          <Input
            aria-label="Lien de preuve"
            placeholder={requiresFile ? "Lien vers la pièce jointe (obligatoire)" : "Lien vers la preuve (facultatif)"}
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          {selectedProof?.description ? (
            <p className="text-xs text-muted-foreground">{selectedProof.description}</p>
          ) : null}
          <Button size="sm" onClick={submitForValidation} disabled={busy}>
            Envoyer pour validation
          </Button>
        </div>
      ) : null}

      {awaitingDecision ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">À valider</p>
          {lastSubmission ? (
            <div className="text-xs text-muted-foreground">
              {lastSubmission.comment ? <p className="whitespace-pre-line">« {lastSubmission.comment} »</p> : null}
              {lastSubmission.proof_url && /^https?:\/\//.test(lastSubmission.proof_url) ? (
                <a className="underline" href={lastSubmission.proof_url} target="_blank" rel="noopener noreferrer">
                  Voir la preuve
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun commentaire joint.</p>
          )}
          <Textarea
            rows={2}
            aria-label="Commentaire de décision"
            placeholder={`Votre commentaire (au moins ${VALIDATION_COMMENT_MIN} caractères)`}
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide("APPROVED")} disabled={busy}>
              Valider la tâche
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide("REJECTED")} disabled={busy}>
              Renvoyer pour complément
            </Button>
          </div>
        </div>
      ) : null}

      {task.status === "COMPLETED" && canValidate ? (
        <Button size="sm" variant="ghost" onClick={reopen} disabled={busy}>
          Rouvrir la tâche
        </Button>
      ) : null}

      <ExternalLinks contextType="TASK" contextId={task.id} embedded />

      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">Discussion</summary>
        <div className="pt-2">
          <Comments
            entityType="task"
            entityId={task.id}
            entityTitle={task.title}
            participants={[task.assigned_user_id]}
            linkUrl="/tasks"
          />
        </div>
      </details>
    </div>
  );
}
