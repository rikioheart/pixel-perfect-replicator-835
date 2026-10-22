import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Briefcase, FolderKanban, ShieldCheck, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AG_CONVOCATION_DAYS, AG_QUORUM, convocationDeadline, isInAgMonth, nextAgYear, quorumReached } from "@/lib/statutes";
import { CharterBanner } from "@/components/CharterBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TASK_STATUS_LABEL, PROJECT_STATUS_LABEL, formatDate } from "@/lib/domain";
import { NewsFeed } from "@/components/NewsFeed";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord Bureau — La Voix du Chien" },
      {
        name: "description",
        content:
          "Vue d'ensemble du Bureau : membres, projets actifs, tâches à valider et activité récente de l'association.",
      },
      { property: "og:title", content: "Tableau de bord Bureau — La Voix du Chien" },
      {
        property: "og:description",
        content: "Pilotage complet de l'association : membres, projets, tâches et validations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isBureau, refresh, roles, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: isBureau,
    queryFn: async () => {
      const [profiles, projects, tasks, pending] = await Promise.all([
        supabase.from("profiles").select("id, membership_type, membership_status"),
        supabase
          .from("projects")
          .select("id, title, status, progress_percent, deadline")
          .order("updated_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, status, updated_at, deadline")
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase.from("tasks").select("id").eq("status", "PENDING_VALIDATION"),
      ]);
      return {
        profiles: profiles.data ?? [],
        projects: projects.data ?? [],
        tasks: tasks.data ?? [],
        pendingCount: pending.data?.length ?? 0,
      };
    },
  });

  if (!loading && !isBureau) {
    return (
      <AppShell title="Espace Bureau" subtitle="Accès réservé aux membres du Bureau">
        <div className="panel max-w-xl space-y-2 p-6">
          <p className="text-sm text-muted-foreground">
            Cet espace est réservé aux membres du Bureau. Un membre du Bureau peut vous confier ce rôle si besoin.
          </p>
          <p className="text-xs text-muted-foreground">Rôles actuels : {roles.length ? roles.join(", ") : "aucun"}</p>
        </div>
      </AppShell>
    );
  }

  const profiles = data?.profiles ?? [];
  const projects = data?.projects ?? [];
  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const avgProgress = activeProjects.length
    ? Math.round(
        activeProjects.reduce((sum, p) => sum + (p.progress_percent ?? 0), 0) /
          activeProjects.length,
      )
    : 0;

  const stats = [
    { label: "Membres", value: profiles.length, icon: Users },
    {
      label: "Professionnels",
      value: profiles.filter((p) => p.membership_type === "PROFESSIONNEL").length,
      icon: Briefcase,
    },
    {
      label: "Particuliers",
      value: profiles.filter((p) => p.membership_type === "PARTICULIER").length,
      icon: Users,
    },
    { label: "Projets actifs", value: activeProjects.length, icon: FolderKanban },
    { label: "Tâches à valider", value: data?.pendingCount ?? 0, icon: ShieldCheck },
  ];

  return (
    <AppShell
      title="Tableau de bord du Bureau"
      subtitle="Petits progrès, preuves et validations"
      actions={
        <Button asChild variant="secondary">
          <Link to="/admin/validation">Validations en attente</Link>
        </Button>
      }
    >
      <AgReminder />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="panel p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wide">{stat.label}</span>
              <stat.icon className="size-4" />
            </div>
            <p className="mt-2 font-display text-3xl">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="panel min-w-0 p-5 lg:col-span-2">
          <h2 className="text-lg">Progression des projets actifs</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Avancement moyen : {avgProgress}%
          </p>
          <div className="space-y-4">
            {activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun projet actif pour le moment.</p>
            ) : (
              activeProjects.slice(0, 6).map((project) => (
                <div key={project.id} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      className="min-w-0 break-words font-medium hover:underline"
                    >
                      {project.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {project.progress_percent}% · {formatDate(project.deadline)}
                    </span>
                  </div>
                  <Progress value={project.progress_percent ?? 0} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel min-w-0 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <h2 className="text-lg">Activité récente</h2>
          </div>
          <ul className="space-y-3">
            {(data?.tasks ?? []).length === 0 ? (
              <EmptyState
                title="Tout est calme"
                message="Aucune tâche enregistrée pour l'instant : le premier petit progrès s'affichera ici."
              />
            ) : (
              data?.tasks.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <Badge variant="secondary">{TASK_STATUS_LABEL[task.status] ?? task.status}</Badge>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <CharterBanner />
        <NewsFeed />
      </div>

      <div className="panel mt-6 p-5">
        <h2 className="mb-4 text-lg">Tous les projets</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Créez votre premier projet depuis la page Projets.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between py-3 text-sm">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="hover:underline"
                >
                  {project.title}
                </Link>
                <Badge variant="outline">
                  {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function AgReminder() {
  const year = nextAgYear(new Date());
  const [agDate, setAgDate] = useState(`${year}-06-20`);
  const [present, setPresent] = useState(0);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(agDate);
  return (
    <section className="panel mb-6 space-y-3 p-5" aria-labelledby="ag-title">
      <h2 id="ag-title" className="flex items-center gap-2 text-lg">
        <CalendarClock className="size-5 text-primary" aria-hidden /> Assemblée générale ordinaire {year}
      </h2>
      <p className="text-sm text-muted-foreground">
        Selon les statuts (article 16) : AG chaque année en juin, convocation avec ordre du jour au
        moins {AG_CONVOCATION_DAYS} jours avant, quorum de {AG_QUORUM} personnes dont des membres du
        Bureau et des fondateurs. Présentiel, visio ou hybride.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Date envisagée
          <Input type="date" value={agDate} onChange={(e) => setAgDate(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm">
          Personnes présentes ou représentées
          <Input type="number" min={0} value={present} onChange={(e) => setPresent(Number(e.target.value) || 0)} className="mt-1" />
        </label>
      </div>
      {valid ? (
        <ul className="space-y-1 text-sm">
          <li>📨 Convocations à envoyer au plus tard le <strong>{new Date(convocationDeadline(agDate)).toLocaleDateString("fr-FR")}</strong>.</li>
          {!isInAgMonth(agDate) ? <li>⚠️ Cette date n'est pas en juin, comme le prévoient les statuts.</li> : null}
          <li>{quorumReached(present) ? "✅ Quorum atteint." : `⏳ Quorum non atteint : ${AG_QUORUM - present} personne(s) manquante(s).`}</li>
        </ul>
      ) : null}
    </section>
  );
}
