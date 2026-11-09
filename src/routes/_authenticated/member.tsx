import { isParticulierView } from "@/lib/nav-rules";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatedProjects } from "@/hooks/useCoordinatedProjects";
import { AppShell } from "@/components/AppShell";
import { HomeHero } from "@/components/HomeHero";
import { MyDogHome } from "@/components/MyDogHome";
import { memberRoleLabel } from "@/lib/dog-timeline";
import { NewsFeed } from "@/components/NewsFeed";
import { UpdatesWall } from "@/components/UpdatesWall";
import { useUserPreferences } from "@/lib/user-preferences";
import { EmptyState } from "@/components/EmptyState";
import { LoyaltyCardMini, ProfileCompletionCard } from "@/components/EngagementCards";
import { PendingActionsStrip } from "@/components/PendingActionsStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TASK_STATUS_LABEL, PROJECT_ROLE_LABEL, formatDate } from "@/lib/domain";
import { profileCompletion } from "@/lib/home-config";
import { isOverdueReservation } from "@/lib/role-home";

export const Route = createFileRoute("/_authenticated/member")({
  head: () => ({
    meta: [
      { title: "Mon foyer & moi — La Voix du Chien" },
      {
        name: "description",
        content:
          "Accueil du membre : son chien, son pass, ses prochaines sorties et les façons de donner un coup de main.",
      },
      { property: "og:title", content: "Mon foyer & moi — La Voix du Chien" },
      {
        property: "og:description",
        content: "Votre chien, votre pass, vos prochaines sorties et l'entraide de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemberDashboard,
});

const REGISTRATION_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  REGISTERED: "Inscrit·e",
  WAITLIST: "Liste d'attente",
  CANCELLED: "Annulée",
};

function MemberDashboard() {
  const { user, profile, isBureau, isPro } = useAuth();

  const { data } = useQuery({
    queryKey: ["member-home", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return { tasks: [], memberships: [], participations: [], activities: [], openHelp: 0 };
      const nowIso = new Date().toISOString();
      const [tasks, memberships, participations, activities, openHelp] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, deadline, needs_help, is_volunteer_task, projects(title)")
          .eq("assigned_user_id", user.id)
          .order("deadline", { ascending: true }),
        supabase
          .from("project_members")
          .select("project_role, projects(id, title, status, progress_percent, deadline)")
          .eq("user_id", user.id),
        supabase
          .from("participations")
          .select("id, registration_status, events(id, title, start_date, location)")
          .eq("user_id", user.id)
          .limit(20),
        supabase
          .from("activities")
          .select("id, title, date, location")
          .gte("date", nowIso)
          .not("status", "in", "(DRAFT,CANCELLED)")
          .order("date", { ascending: true })
          .limit(4),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("is_volunteer_task", true)
          .is("assigned_user_id", null)
          .in("status", ["TODO", "IN_PROGRESS"]),
      ]);
      return {
        tasks: tasks.data ?? [],
        memberships: memberships.data ?? [],
        participations: participations.data ?? [],
        activities: activities.data ?? [],
        openHelp: openHelp.count ?? 0,
      };
    },
  });

  const tasks = data?.tasks ?? [];
  const open = tasks.filter((task) => !["COMPLETED", "ARCHIVED", "CANCELLED"].includes(task.status));
  const done = tasks.filter((task) => task.status === "COMPLETED");
  const upcoming = (data?.participations ?? [])
    .filter((p) => p.events?.start_date && p.events.start_date >= new Date().toISOString())
    .sort((a, b) => (a.events?.start_date ?? "").localeCompare(b.events?.start_date ?? ""));
  const memberships = data?.memberships ?? [];
  const showProfileCard = profileCompletion(profile).percent < 100;

  const roleLabel = memberRoleLabel({ isBureau, isPro });
  const welcome = isParticulierView({ isBureau, isPro })
    ? "Votre compagnon, votre pass et vos prochaines sorties."
    : "Votre chien, votre pass et ce qui vous concerne ici.";

  return (
    <AppShell title="Mon foyer & moi" subtitle="Ce qui vous concerne, rien de plus">
      <div className="space-y-6">
        <HomeHero
          firstName={profile?.first_name ?? profile?.display_name ?? ""}
          roleLabel={roleLabel}
          message={welcome}
        />

        {user ? <MyDogHome userId={user.id} hideWhenEmpty={!isParticulierView({ isBureau, isPro })} /> : null}

        <CoordinatorInbox userId={user?.id} />

        <div className={`grid gap-4 sm:grid-cols-2 ${showProfileCard ? "xl:grid-cols-3" : ""}`}>
          <LoyaltyCardMini />
          <HelpInvitation openCount={data?.openHelp ?? 0} />
          {showProfileCard ? <ProfileCompletionCard /> : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <div className="panel p-5">
              <h2 className="mb-4 text-lg">Mes prochaines sorties</h2>
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
                      <Badge variant="secondary">{REGISTRATION_LABEL[p.registration_status] ?? p.registration_status}</Badge>
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
                        <Link to="/activities/$activityId" params={{ activityId: activity.id }}>Voir</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {open.length > 0 ? (
              <div className="panel p-5">
                <h2 className="mb-4 text-lg">Mes tâches en cours</h2>
                <ul className="divide-y divide-border">
                  {open.slice(0, 8).map((task) => (
                    <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.projects?.title ?? "Hors projet"} · {formatDate(task.deadline)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {task.needs_help ? <Badge variant="outline">Aide demandée</Badge> : null}
                        <Badge variant="secondary">{TASK_STATUS_LABEL[task.status] ?? task.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                  {done.length ? (
                    <p className="text-xs text-muted-foreground">{done.length} tâche(s) déjà validée(s). Merci !</p>
                  ) : <span />}
                  <Button asChild size="sm" variant="ghost"><Link to="/tasks">Toutes mes tâches</Link></Button>
                </div>
              </div>
            ) : null}

            {memberships.length > 0 ? (
              <div className="panel p-5">
                <h2 className="mb-4 text-lg">Mes projets</h2>
                <div className="space-y-5">
                  {memberships.map((membership) =>
                    membership.projects ? (
                      <div key={membership.projects.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <Link
                            to="/projects/$projectId"
                            params={{ projectId: membership.projects.id }}
                            className="truncate font-medium hover:underline"
                          >
                            {membership.projects.title}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {PROJECT_ROLE_LABEL[membership.project_role] ?? membership.project_role}
                          </span>
                        </div>
                        <Progress value={membership.projects.progress_percent ?? 0} />
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-6">
            <NewsFeed />
            <MemberWall />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** Invitation douce à contribuer : une seule porte, vers « Je veux aider ». */
function HelpInvitation({ openCount }: { openCount: number }) {
  return (
    <div className="panel flex flex-col p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">Entraide</span>
        <Heart className="size-4" aria-hidden />
      </div>
      <p className="mt-2 font-display text-xl">Envie de donner un coup de main ?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {openCount > 0
          ? `${openCount} tâche(s) ouverte(s) aux bénévoles en ce moment, à votre rythme.`
          : "Proposez vos compétences ou un peu de temps, le Bureau vous oriente."}
      </p>
      <Button asChild size="sm" variant="ghost" className="mt-auto self-start px-0 pt-2">
        <Link to="/je-veux-aider">Je veux aider</Link>
      </Button>
    </div>
  );
}

/** Pour un responsable de projet : ce qui attend sa décision dans ses projets uniquement (droits vérifiés par la base). */
function CoordinatorInbox({ userId }: { userId: string | undefined }) {
  const coordinated = useCoordinatedProjects(userId);
  const ids = [...coordinated].sort();
  const { data, isLoading } = useQuery({
    queryKey: ["coordinator-inbox", userId, ids.join(",")],
    enabled: Boolean(userId) && ids.length > 0,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [tasks, offers, loans] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).in("project_id", ids).eq("status", "PENDING_VALIDATION"),
        supabase.from("contributions").select("id", { count: "exact", head: true }).in("project_id", ids).in("status", ["PROPOSED", "DISCUSSION"]),
        supabase.from("inventory_reservations").select("status, end_date").in("project_id", ids).eq("status", "ACTIVE").lt("end_date", today),
      ]);
      return {
        tasks: tasks.error ? null : (tasks.count ?? 0),
        offers: offers.error ? null : (offers.count ?? 0),
        loans: loans.error ? null : (loans.data ?? []).filter((r) => isOverdueReservation(r, today)).length,
      };
    },
  });
  if (ids.length === 0) return null;
  const single = ids.length === 1 ? ids[0] : null;
  return (
    <PendingActionsStrip
      title="À traiter dans vos projets"
      loading={isLoading}
      calmMessage="Rien n'attend votre décision dans vos projets."
      items={[
        { key: "tasks", label: "Tâches à valider", count: data?.tasks ?? 0, to: "/tasks", search: single ? { projectId: single } : undefined },
        { key: "offers", label: "Propositions d'aide reçues", count: data?.offers ?? 0, to: single ? `/projects/${single}` : "/projects" },
        { key: "loans", label: "Matériel non rendu", count: data?.loans ?? 0, to: "/inventory" },
      ]}
    />
  );
}

function MemberWall() {
  const { preferences } = useUserPreferences();
  if (!preferences || preferences.show_association_updates === false) return null;
  return <UpdatesWall limit={4} compact />;
}
