import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TASK_STATUS_LABEL, PRIORITY_LABEL, formatDate } from "@/lib/domain";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  assigned_user_id: string | null;
  rejection_reason: string | null;
  projects?: { title: string } | null;
};

export function TaskCard({
  task,
  currentUserId,
  isBureau,
  onChanged,
  showProject = true,
}: {
  task: TaskRow;
  currentUserId: string;
  isBureau: boolean;
  onChanged: () => void;
  showProject?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofType, setProofType] = useState("");
  const proofTypes = useConfigOptions("PROOF_TYPE");

  const isMine = task.assigned_user_id === currentUserId;
  const canAct = isMine || isBureau;

  // Chaque type de preuve déclare les statuts de tâche auxquels il s'applique.
  const allowedProofs = proofTypes.options.filter((option) => {
    const statuses = (option as { metadata?: { task_statuses?: string[] } }).metadata?.task_statuses;
    return !statuses || statuses.length === 0 || statuses.includes(task.status);
  });
  const selectedProof = allowedProofs.find((option) => option.code === proofType);
  const requiresFile = Boolean(
    (selectedProof as { metadata?: { requires_file?: boolean } } | undefined)?.metadata?.requires_file,
  );

  const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    const { error } = await supabase.from("tasks").update({ status, ...extra }).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  };

  const submitProof = async () => {
    if (!comment.trim() && !proofUrl.trim()) {
      toast.error("Ajoutez un commentaire ou un lien de preuve.");
      return;
    }
    if (requiresFile && !/^https?:\/\//.test(proofUrl.trim())) {
      toast.error(`Le type « ${selectedProof?.label} » demande un lien vers la pièce jointe.`);
      return;
    }
    const { error } = await supabase.from("task_submissions").insert({
      task_id: task.id,
      submitted_by: currentUserId,
      comment: comment.trim() || null,
      proof_url: proofUrl.trim() || null,
      proof_type: proofType || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await setStatus("PENDING_VALIDATION", { submitted_at: new Date().toISOString() });
    toast.success("Preuve envoyée au Bureau.");
    setSubmitting(false);
    setComment("");
    setProofUrl("");
    setProofType("");
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
        <p className="rounded-md bg-muted p-2 text-xs">
          Retour du Bureau : {task.rejection_reason}
        </p>
      ) : null}

      {canAct ? (
        <div className="flex flex-wrap gap-2">
          {task.status === "TODO" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setStatus("IN_PROGRESS", { started_at: new Date().toISOString() })}
            >
              Démarrer
            </Button>
          ) : null}
          {["IN_PROGRESS", "WAITING", "BLOCKED"].includes(task.status) ? (
            <>
              <Button size="sm" onClick={() => setSubmitting((value) => !value)}>
                Soumettre une preuve
              </Button>
              {task.status !== "BLOCKED" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus("BLOCKED")}>
                  Signaler un blocage
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {submitting ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Textarea
            rows={2}
            placeholder="Ce qui a été fait"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Input
            placeholder="Lien vers la preuve (document, photo, page…)"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          <Button size="sm" onClick={submitProof}>
            Envoyer au Bureau
          </Button>
        </div>
      ) : null}
    </div>
  );
}
