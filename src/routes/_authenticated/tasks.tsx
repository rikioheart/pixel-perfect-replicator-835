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
  component: TasksPage,
});

function TasksPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"MINE" | "ALL">("MINE");
  const [status, setStatus] = useState("ALL");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskPanelValue | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", scope, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(
          "id, title, description, status, priority, deadline, assigned_user_id, project_id, rejection_reason, projects(title)",
        )
        .order("deadline", { ascending: true });
      if (scope === "MINE") query = query.eq("assigned_user_id", user!.id);
      return ((await query).data ?? []) as TaskRow[];
    },
  });

  const filtered = (tasks ?? []).filter((task) => status === "ALL" || task.status === status);

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
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MINE">Mes tâches</SelectItem>
            <SelectItem value="ALL">Toutes les tâches visibles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
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

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune tâche à afficher.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((task) => (
            <div key={task.id} className="relative">
              {isBureau || task.assigned_user_id === user?.id ? (
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
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
      />
    </AppShell>
  );
}
