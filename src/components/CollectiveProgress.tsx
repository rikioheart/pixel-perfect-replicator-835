import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/domain";

/**
 * Avancement collectif d'un projet, exprimé tel qu'il est mesuré : tâches validées par l'équipe
 * et étapes franchies. Aucune jauge sans données (pas de faux 0 %), aucune mesure individuelle.
 */
export function CollectiveProgress({
  title,
  tasks,
  milestones,
}: {
  title: string;
  tasks: { done: number; counted: number; percent: number | null };
  milestones: { done: number; total: number; next: { title: string; due_date: string | null } | null };
}) {
  return (
    <div className="space-y-1.5">
      {tasks.percent === null ? (
        <p className="text-xs text-muted-foreground">Pas encore de tâche : la jauge apparaîtra avec la première.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Tâches validées ensemble</span>
            <span className="shrink-0 font-medium">{tasks.done} sur {tasks.counted}</span>
          </div>
          <Progress
            tone="collective"
            value={tasks.percent}
            aria-label={`${title} : ${tasks.done} tâche${tasks.done > 1 ? "s" : ""} validée${tasks.done > 1 ? "s" : ""} sur ${tasks.counted}, annulées exclues`}
          />
        </>
      )}
      {milestones.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          Étapes franchies : {milestones.done} sur {milestones.total}
          {milestones.next ? ` · prochaine : ${milestones.next.title}${milestones.next.due_date ? ` (${formatDate(milestones.next.due_date)})` : ""}` : " · toutes franchies"}
        </p>
      ) : null}
    </div>
  );
}
