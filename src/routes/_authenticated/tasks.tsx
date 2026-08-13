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

  const { data: tasks } = useQuery({
    queryKey: ["tasks", scope, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(
          "id, title, description, status, priority, deadline, assigned_user_id, rejection_reason, projects(title)",
        )
        .order("deadline", { ascending: true });
      if (scope === "MINE") query = query.eq("assigned_user_id", user!.id);
      return ((await query).data ?? []) as TaskRow[];
    },
  });

  const filtered = (tasks ?? []).filter((task) => status === "ALL" || task.status === status);

  return (
    <AppShell title="Tâches" subtitle="Une tâche terminée est une tâche prouvée et validée">
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
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={user?.id ?? ""}
              isBureau={isBureau}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
