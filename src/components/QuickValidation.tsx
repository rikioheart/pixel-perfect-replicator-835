import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/domain";
import {
  VALIDATION_COMMENT_MIN,
  decideTaskValidation,
  type ValidationDecision,
} from "@/lib/validation-actions";

type QuickValidationItem = {
  id: string;
  title: string;
  submitted_at?: string | null;
  assignee?: string | null;
};

export function QuickValidationRow({ task }: { task: QuickValidationItem }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<ValidationDecision | null>(null);

  const run = async (decision: ValidationDecision) => {
    setBusy(decision);
    try {
      await decideTaskValidation({
        taskId: task.id,
        taskTitle: task.title,
        decision,
        comment,
        actorId: user?.id ?? null,
      });
      toast.success(
        decision === "APPROVED"
          ? "Action validée, l'historique est à jour."
          : "Action renvoyée avec votre commentaire.",
      );
      setComment("");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Décision impossible.");
    } finally {
      setBusy(null);
    }
  };

  const tooShort = comment.trim().length < VALIDATION_COMMENT_MIN;

  return (
    <div className="space-y-2 border-b border-border pb-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{task.title}</p>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {task.submitted_at ? formatDate(task.submitted_at) : "—"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{task.assignee ?? "Non attribué"}</p>
      <Textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire obligatoire : ce qui est validé, ou ce qui manque"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={tooShort || busy !== null} onClick={() => run("APPROVED")}>
          Valider
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={tooShort || busy !== null}
          onClick={() => run("REJECTED")}
        >
          Renvoyer
        </Button>
        {tooShort ? (
          <span className="text-xs text-muted-foreground">Commentaire requis</span>
        ) : null}
      </div>
    </div>
  );
}
