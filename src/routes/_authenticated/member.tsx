import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { CharterBanner } from "@/components/CharterBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TASK_STATUS_LABEL, PROJECT_ROLE_LABEL, formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/member")({
  head: () => ({
    meta: [
      { title: "Mon espace membre — La Voix du Chien" },
      {
        name: "description",
        content:
          "Espace personnel du membre : mes tâches, mes projets et mes contributions à l'association.",
      },
      { property: "og:title", content: "Mon espace membre — La Voix du Chien" },
      {
        property: "og:description",
        content: "Suivez vos tâches, vos preuves déposées et vos projets d'engagement.",
      },
    ],
  }),
  component: MemberDashboard,
});

function MemberDashboard() {
  const { user, profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["member-dashboard", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [tasks, memberships] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, deadline, projects(title)")
          .eq("assigned_user_id", user!.id)
          .order("deadline", { ascending: true }),
        supabase
          .from("project_members")
          .select("project_role, projects(id, title, status, progress_percent, deadline)")
          .eq("user_id", user!.id),
      ]);
      return { tasks: tasks.data ?? [], memberships: memberships.data ?? [] };
    },
  });

  const tasks = data?.tasks ?? [];
  const open = tasks.filter((task) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(task.status));
  const done = tasks.filter((task) => task.status === "COMPLETED");

  return (
    <AppShell
      title={`Bonjour ${profile?.first_name ?? profile?.display_name ?? ""}`.trim()}
      subtitle="Vos engagements, vos preuves, vos progrès"
      actions={
        <Button asChild variant="secondary">
          <Link to="/tasks">Voir toutes mes tâches</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tâches en cours</p>
          <p className="mt-2 font-display text-3xl">{open.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tâches validées</p>
          <p className="mt-2 font-display text-3xl">{done.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projets rejoints</p>
          <p className="mt-2 font-display text-3xl">{data?.memberships.length ?? 0}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-4 text-lg">Mes prochaines tâches</h2>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tâche assignée pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-border">
              {open.slice(0, 8).map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.projects?.title ?? "Hors projet"} · {formatDate(task.deadline)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {TASK_STATUS_LABEL[task.status] ?? task.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-lg">Mes projets</h2>
          {(data?.memberships ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Vous ne participez à aucun projet pour le moment.
            </p>
          ) : (
            <div className="space-y-4">
              {data?.memberships.map((membership) =>
                membership.projects ? (
                  <div key={membership.projects.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: membership.projects.id }}
                        className="font-medium hover:underline"
                      >
                        {membership.projects.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {PROJECT_ROLE_LABEL[membership.project_role] ?? membership.project_role}
                      </span>
                    </div>
                    <Progress value={membership.projects.progress_percent ?? 0} />
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
