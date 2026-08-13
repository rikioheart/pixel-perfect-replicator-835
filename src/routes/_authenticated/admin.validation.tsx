import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, PRIORITY_LABEL } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/validation")({
  head: () => ({
    meta: [
      { title: "Validations — La Voix du Chien" },
      {
        name: "description",
        content:
          "File de validation du Bureau : preuves soumises par les membres, approbation ou retour argumenté.",
      },
      { property: "og:title", content: "Validations — La Voix du Chien" },
      {
        property: "og:description",
        content: "Valider ou renvoyer les tâches soumises avec preuve par les membres.",
      },
    ],
  }),
  component: ValidationPage,
});

function ValidationPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: tasks } = useQuery({
    queryKey: ["pending-validation"],
    enabled: isBureau,
    queryFn: async () =>
      (
        await supabase
          .from("tasks")
          .select(
            "id, title, description, priority, deadline, submitted_at, projects(title), task_submissions(id, comment, proof_url, submitted_at)",
          )
          .eq("status", "PENDING_VALIDATION")
          .order("submitted_at", { ascending: true })
      ).data ?? [],
  });

  const decide = async (taskId: string, taskTitle: string, approve: boolean) => {
    try {
      await decideTaskValidation({
        taskId,
        taskTitle,
        decision: approve ? "APPROVED" : "REJECTED",
        comment: comments[taskId] ?? "",
        actorId: user?.id ?? null,
      });
      setComments({ ...comments, [taskId]: "" });
      toast.success(approve ? "Tâche validée." : "Tâche renvoyée au membre.");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Décision impossible.");
    }
  };


  if (!isBureau) {
    return (
      <AppShell title="Validations" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Seuls les membres du Bureau peuvent valider les tâches.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="File de validation"
      subtitle="Aucune tâche n'est terminée sans preuve validée"
    >
      {(tasks ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune tâche en attente de validation.</p>
      ) : (
        <div className="space-y-4">
          {tasks?.map((task) => (
            <div key={task.id} className="panel space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg">{task.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {task.projects?.title ?? "Hors projet"} · soumise le{" "}
                    {formatDate(task.submitted_at)}
                  </p>
                </div>
                <Badge variant="outline">
                  {PRIORITY_LABEL[task.priority] ?? task.priority} · échéance{" "}
                  {formatDate(task.deadline)}
                </Badge>
              </div>

              {task.description ? (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              ) : null}

              <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Preuves déposées
                </p>
                {(task.task_submissions ?? []).length === 0 ? (
                  <p className="text-muted-foreground">Aucune preuve jointe.</p>
                ) : (
                  task.task_submissions.map((submission) => (
                    <div key={submission.id} className="space-y-1">
                      <p>{submission.comment || "Sans commentaire"}</p>
                      {submission.proof_url ? (
                        <a
                          href={submission.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline"
                        >
                          Ouvrir la preuve
                        </a>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <Textarea
                rows={2}
                placeholder="Commentaire obligatoire : ce qui est validé, ou ce qui manque"
                value={comments[task.id] ?? ""}
                onChange={(e) => setComments({ ...comments, [task.id]: e.target.value })}
              />

              <div className="flex items-center gap-2">
                <Button
                  disabled={(comments[task.id] ?? "").trim().length < VALIDATION_COMMENT_MIN}
                  onClick={() => decide(task.id, task.title, true)}
                >
                  Valider
                </Button>
                <Button
                  variant="outline"
                  disabled={(comments[task.id] ?? "").trim().length < VALIDATION_COMMENT_MIN}
                  onClick={() => decide(task.id, task.title, false)}
                >
                  Renvoyer
                </Button>
                <span className="text-xs text-muted-foreground">Commentaire requis</span>
              </div>

            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
