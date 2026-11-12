import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { TaskCard, type TaskRow } from "@/components/TaskCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { TaskPanel, type TaskPanelValue } from "@/components/panels/TaskPanel";
import { useCoordinatedProjects } from "@/hooks/useCoordinatedProjects";
import { canValidateTask } from "@/lib/task-lifecycle";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tâches — La Voix du Chien" },
      {
        name: "description",
        content:
          "Suivi des tâches de l'association : démarrage, blocages, dépôt de preuves et validation par le Bureau.",
      },
      { property: "og:title", content: "Tâches — La Voix du Chien" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Gérez vos tâches associatives et déposez vos preuves d'avancement.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { projectId?: string } =>
    typeof search["projectId"] === "string" && search["projectId"] ? { projectId: search["projectId"] as string } : {},
  component: TasksPage,
});

function TasksPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const coordinated = useCoordinatedProjects(user?.id);
  const { projectId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [scope, setScope] = useState<"MINE" | "ALL">(projectId ? "ALL" : "MINE");
  const { data: projectList = [] } = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () => (await supabase.from("projects").select("id,title").order("title")).data ?? [],
  });
  const [status, setStatus] = useState("ALL");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskPanelValue | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", scope, user?.id, projectId ?? null],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(
          "id, title, description, status, priority, deadline, assigned_user_id, created_by, project_id, rejection_reason, projects(title)",
        )
        .order("deadline", { ascending: true });
      if (scope === "MINE") query = query.eq("assigned_user_id", user!.id);
      if (projectId) query = query.eq("project_id", projectId);
      return ((await query).data ?? []) as TaskRow[];
    },
  });

  const filtered = (tasks ?? []).filter((task) => status === "ALL" || task.status === status);
  const validatorFor = (task: TaskRow | TaskPanelValue | null) =>
    task
      ? canValidateTask(task, {
          userId: user?.id,
          isBureau,
          isProjectCoordinator: Boolean(task.project_id && coordinated.has(task.project_id)),
        })
      : isBureau;

  return (
    <AppShell
      title="Tâches"
      subtitle="Une tâche terminée est une tâche prouvée et validée"
      actions={
        <Button
          onClick={() => {
            setEditingTask(null);
            setPanelOpen(true);
          }}
        >
          Nouvelle tâche
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Select value={scope} onValueChange={(value) => setScope(value as "MINE" | "ALL")}>
          <SelectTrigger className="w-52" aria-label="Tâches affichées">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MINE">Mes tâches</SelectItem>
            <SelectItem value="ALL">Toutes les tâches visibles</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={projectId ?? "ALL"}
          onValueChange={(v) => void navigate({ search: v === "ALL" ? {} : { projectId: v } })}
        >
          <SelectTrigger className="w-60" aria-label="Projet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les projets</SelectItem>
            {projectList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52" aria-label="Statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {TASK_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {TASK_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks === undefined ? (
        <LoadingState rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          art="playful"
          title={status === "ALL" ? "Aucune tâche pour l'instant" : "Aucune tâche dans ce statut"}
          message={
            status === "ALL"
              ? "Les tâches qui vous sont confiées, ou que vous suivez, apparaîtront ici."
              : "Choisissez un autre statut pour retrouver vos autres tâches."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((task) => (
            <div key={task.id} className="relative">
              {isBureau ||
              task.assigned_user_id === user?.id ||
              task.created_by === user?.id ||
              validatorFor(task) ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Modifier la tâche"
                  className="absolute right-2 top-2 z-10 min-h-9 min-w-9"
                  onClick={() => {
                    setEditingTask(task as TaskPanelValue);
                    setPanelOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              ) : null}
              <TaskCard
                task={task}
                currentUserId={user?.id ?? ""}
                isBureau={isBureau}
                canValidate={validatorFor(task)}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
              />
            </div>
          ))}
        </div>
      )}

      <TaskPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        task={editingTask}
        defaultProjectId={projectId ?? null}
        canValidate={validatorFor(editingTask)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
      />
    </AppShell>
  );
}
