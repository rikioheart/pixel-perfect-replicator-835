import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HandHeart, CalendarDays, ListChecks, FolderKanban, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { HomeHero } from "@/components/HomeHero";
import { MyDogHome } from "@/components/MyDogHome";
import { memberRoleLabel } from "@/lib/dog-timeline";
import { NewsFeed } from "@/components/NewsFeed";
import { UpdatesWall } from "@/components/UpdatesWall";
import { useUserPreferences } from "@/lib/user-preferences";
import { EmptyState } from "@/components/EmptyState";
import { LoyaltyCardMini, ProfileCompletionCard } from "@/components/EngagementCards";
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
          "Espace personnel du membre : mes tâches, mes inscriptions, ma fidélité et l'actualité de l'association.",
      },
      { property: "og:title", content: "Mon espace membre — La Voix du Chien" },
      {
        property: "og:description",
        content: "Un accueil personnalisé selon votre rôle : tâches, événements, fidélité et actualités.",
      },
    ],
  }),
  component: MemberDashboard,
});

function MemberDashboard() {
  const { user, profile, isBureau, isPro } = useAuth();

  const { data } = useQuery({
    queryKey: ["member-home", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [tasks, memberships, participations, activities] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, deadline, needs_help, is_volunteer_task, projects(title)")
          .eq("assigned_user_id", user!.id)
          .order("deadline", { ascending: true }),
        supabase
          .from("project_members")
          .select("project_role, projects(id, title, status, progress_percent, deadline)")
          .eq("user_id", user!.id),
        supabase
          .from("participations")
          .select("id, registration_status, events(id, title, start_date, location)")
          .eq("user_id", user!.id)
          .limit(20),
        supabase
          .from("activities")
          .select("id, title, date, location")
          .gte("date", nowIso)
          .order("date", { ascending: true })
          .limit(4),
      ]);
      return {
        tasks: tasks.data ?? [],
        memberships: memberships.data ?? [],
        participations: participations.data ?? [],
        activities: activities.data ?? [],
      };
    },
  });

  const tasks = data?.tasks ?? [];
  const open = tasks.filter((task) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(task.status));
  const done = tasks.filter((task) => task.status === "COMPLETED");
  const upcoming = (data?.participations ?? [])
    .filter((p) => p.events?.start_date && p.events.start_date >= new Date().toISOString())
    .sort((a, b) => (a.events?.start_date ?? "").localeCompare(b.events?.start_date ?? ""));

  const roleLabel = memberRoleLabel({ isBureau, isPro });

  const welcome = isPro
    ? "Vos prochaines activités, vos tâches en cours et vos tampons à valider."
    : isBureau
      ? "Vos tâches assignées et les événements proches."
      : "Votre compagnon, vos sorties à venir à venir, votre carte fidélité et les dernières publications.";

  return (
    <AppShell
      title="Mon espace"
      subtitle="Ce qui vous concerne, rien de plus"
      actions={
        <Button asChild variant="secondary">
          <Link to="/tasks">Mes tâches</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <HomeHero
          firstName={profile?.first_name ?? profile?.display_name ?? ""}
          roleLabel={roleLabel}
          message={welcome}
        />

        {!isBureau && user ? <MyDogHome userId={user.id} /> : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/activities">S'inscrire à une activité</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/events">Voir les événements</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/loyalty">Ma carte fidélité</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/professionals">Annuaire des professionnels</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/tasks">
              <HandHeart className="size-4" /> J'ai besoin d'aide
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tâches en cours" value={open.length} icon={ListChecks} />
          <StatCard label="Projets rejoints" value={data?.memberships.length ?? 0} icon={FolderKanban} />
          <LoyaltyCardMini />
          <ProfileCompletionCard />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="panel p-5">
              <h2 className="mb-4 text-lg">Mes prochaines tâches</h2>
              {open.length === 0 ? (
                <EmptyState
                  title="Rien d'urgent aujourd'hui"
                  message="Vous n'avez aucune tâche en cours. Un petit pas vous tente ? Les projets cherchent souvent un coup de main."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link to="/projects">Découvrir les projets</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {open.slice(0, 8).map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.projects?.title ?? "Hors projet"} · {formatDate(task.deadline)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {task.needs_help ? <Badge variant="outline">Aide demandée</Badge> : null}
                        <Badge variant="secondary">
                          {TASK_STATUS_LABEL[task.status] ?? task.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {done.length ? (
                <p className="pt-3 text-xs text-muted-foreground">
                  {done.length} tâche(s) déjà validée(s). Chaque petit progrès compte.
                </p>
              ) : null}
            </div>

            <div className="panel p-5">
              <h2 className="mb-4 text-lg">
                {isPro ? "Mes prochaines activités" : "Mes inscriptions à venir"}
              </h2>
              {upcoming.length === 0 && (data?.activities ?? []).length === 0 ? (
                <EmptyState
                  title="Aucune date prévue"
                  message="Les prochaines balades, ateliers et événements apparaîtront ici dès leur ouverture."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link to="/activities">Parcourir les activités</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.events?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.events?.location ?? "Lieu à préciser"} · {formatDate(p.events?.start_date ?? null)}
                        </p>
                      </div>
                      <Badge variant="secondary">{p.registration_status}</Badge>
                    </li>
                  ))}
                  {(data?.activities ?? []).slice(0, 4).map((activity) => (
                    <li key={activity.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.location ?? "Lieu à préciser"} · {formatDate(activity.date)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/activities">S'inscrire</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel p-5">
              <h2 className="mb-4 text-lg">Mes projets</h2>
              {(data?.memberships ?? []).length === 0 ? (
                <EmptyState
                  title="Pas encore de projet"
                  message="Rejoindre un projet, c'est avancer avec les autres — même pour une seule tâche."
                />
              ) : (
                <div className="space-y-5">
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

          <div className="space-y-6">
            <NewsFeed />
            <MemberWall />
            {isPro ? (
              <div className="panel p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Briefcase className="size-4 text-muted-foreground" />
                  <h2 className="text-lg">Mon activité pro</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Vos prestations, votre fiche publique et vos réservations de terrain.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/professionals">Ma fiche</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/terrain">Réserver le terrain</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="panel p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <h2 className="text-lg">Envie de participer ?</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Balades, ateliers, coups de main ponctuels : chacun avance à son rythme.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link to="/events">Voir les prochains rendez-vous</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <Icon className="size-4" />
      </div>
      <p className="mt-2 font-display text-3xl">{value}</p>
    </div>
  );
}

function MemberWall() {
  const { preferences } = useUserPreferences();
  if (!preferences || preferences.show_association_updates === false) return null;
  return <UpdatesWall limit={4} compact />;
}
