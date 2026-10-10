import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Euro,
  FolderKanban,
  Handshake,
  HelpCircle,
  Landmark,
  Lightbulb,
  ListChecks,
  Newspaper,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CharterBanner } from "@/components/CharterBanner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PROJECT_STATUS_LABEL, TASK_STATUS_LABEL, formatDate } from "@/lib/domain";
import { QuickValidationRow } from "@/components/QuickValidation";


export const Route = createFileRoute("/_authenticated/admin/cockpit")({
  head: () => ({
    meta: [
      { title: "Cockpit de pilotage — La Voix du Chien" },
      {
        name: "description",
        content:
          "Réponses immédiates du Bureau : avancement des projets, qui fait quoi, blocages, validations, événements, finances et stocks.",
      },
      { property: "og:title", content: "Cockpit de pilotage — La Voix du Chien" },
      {
        property: "og:description",
        content: "Toutes les réponses du Bureau sur une seule page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CockpitPage,
});

const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString();

function CockpitPage() {
  const { isBureau } = useAuth();

  const { data } = useQuery({
    queryKey: ["bureau-cockpit"],
    enabled: isBureau,
    queryFn: async () => {
      const since = weekAgo();
      const today = new Date().toISOString().slice(0, 10);
      const [
        projects,
        tasks,
        profiles,
        events,
        activities,
        participations,
        partners,
        mairies,
        posts,
        proposals,
        inventory,
        reimbursements,
        accounting,
        pros,
      ] = await Promise.all([
        supabase.from("projects").select("id, title, status, progress_percent, deadline, owner_id, updated_at"),
        supabase
          .from("tasks")
          .select(
            "id, title, status, priority, needs_help, is_volunteer_task, deadline, assigned_user_id, project_id, updated_at, submitted_at",
          ),
        supabase.from("profiles").select("id, display_name, first_name, last_name, membership_type"),
        supabase.from("events").select("id, title, start_date, status, event_type, professional_ids").order("start_date"),
        supabase.from("activities").select("id, title, date, status, type, capacity").order("date"),
        supabase.from("participations").select("id, user_id, event_id, activity_id, registration_status"),
        supabase.from("partners").select("id, name, type, active"),
        supabase.from("mairies").select("id, organization, city, status"),
        supabase.from("blog_posts").select("id, title, status, updated_at"),
        supabase.from("professional_proposals").select("id, title, type, status, submitted_by, created_at"),
        supabase.from("inventory").select("id, name, quantity, alert_threshold, location"),
        supabase.from("reimbursements").select("id, label, amount, status, person_id"),
        supabase.from("accounting").select("id, label, professional_share, association_share, recorded_on"),
        supabase.from("pro_details").select("profile_id, company_name"),
      ]);

      return {
        since,
        today,
        projects: projects.data ?? [],
        tasks: tasks.data ?? [],
        profiles: profiles.data ?? [],
        events: events.data ?? [],
        activities: activities.data ?? [],
        participations: participations.data ?? [],
        partners: partners.data ?? [],
        mairies: mairies.data ?? [],
        posts: posts.data ?? [],
        proposals: proposals.data ?? [],
        inventory: inventory.data ?? [],
        reimbursements: reimbursements.data ?? [],
        accounting: accounting.data ?? [],
        pros: pros.data ?? [],
      };
    },
  });

  if (!isBureau) {
    return (
      <AppShell title="Cockpit de pilotage" subtitle="Réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux membres du Bureau. Votre espace personnel reste accessible
          depuis « Mon espace ».
        </p>
      </AppShell>
    );
  }

  const nameOf = (id?: string | null) => {
    if (!id) return "Non attribué";
    const p = data?.profiles.find((x) => x.id === id);
    return (
      p?.display_name ??
      [p?.first_name, p?.last_name].filter(Boolean).join(" ") ??
      "Membre"
    ) || "Membre";
  };

  const tasks = data?.tasks ?? [];
  const projects = data?.projects ?? [];
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO");
  const blocked = tasks.filter((t) => t.needs_help);
  const doneTasks = tasks.filter((t) => t.status === "COMPLETED");
  const toValidate = tasks.filter((t) => t.status === "PENDING_VALIDATION");
  const volunteerTasks = tasks.filter((t) => t.is_volunteer_task && !t.assigned_user_id);
  const movingProjects = projects.filter((p) => data && p.updated_at >= data.since);
  const upcomingEvents = (data?.events ?? []).filter((e) => !e.start_date || e.start_date >= (data?.today ?? ""));
  const upcomingActivities = (data?.activities ?? []).filter((a) => !a.date || a.date >= (data?.today ?? ""));
  const activePartners = (data?.partners ?? []).filter((p) => p.active);
  const mairieProjects = (data?.mairies ?? []).filter((m) => m.status !== "CLOSED");
  const draftPosts = (data?.posts ?? []).filter((p) => p.status !== "PUBLISHED");
  const newProposals = (data?.proposals ?? []).filter((p) => p.status === "PENDING");
  const lowStock = (data?.inventory ?? []).filter((i) => i.quantity <= i.alert_threshold);
  const pendingRefunds = (data?.reimbursements ?? []).filter((r) => r.status === "PENDING");
  const dueToPros = (data?.accounting ?? []).reduce((sum, a) => sum + Number(a.professional_share ?? 0), 0);
  const proIds = new Set((data?.pros ?? []).map((p) => p.profile_id));
  const participantIds = new Set((data?.participations ?? []).map((p) => p.user_id));
  const proParticipants = [...participantIds].filter((id) => proIds.has(id));
  const privateParticipants = [...participantIds].filter((id) => !proIds.has(id));

  const kpis = [
    { label: "Tâches en cours", value: inProgress.length, icon: ListChecks, to: "/tasks" },
    { label: "Besoins d'aide", value: blocked.length, icon: HelpCircle, to: "/help-requests" },
    { label: "À valider", value: toValidate.length, icon: ShieldCheck, to: "/admin/validation" },
    { label: "Terminées", value: doneTasks.length, icon: Sparkles, to: "/tasks" },
    { label: "Projets actifs cette semaine", value: movingProjects.length, icon: FolderKanban, to: "/projects" },
  ];

  return (
    <AppShell
      title="Cockpit de pilotage"
      subtitle="Les réponses du Bureau, en un coup d'œil"
      actions={
        <Button asChild variant="secondary">
          <Link to="/admin/validation">Validations en attente</Link>
        </Button>
      }
    >
      <CharterBanner />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.to} className="panel block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wide">{kpi.label}</span>
              <kpi.icon className="size-4" />
            </div>
            <p className="mt-2 font-display text-3xl">{kpi.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Block icon={FolderKanban} title="Où en est chaque projet ?" empty={projects.length === 0}>
          {projects.map((p) => (
            <div key={p.id} className="space-y-1 border-b border-border pb-2 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="truncate font-medium hover:underline">
                  {p.title}
                </Link>
                <Badge variant="outline">{PROJECT_STATUS_LABEL[p.status] ?? p.status}</Badge>
              </div>
              <Progress value={p.progress_percent} />
              <p className="text-xs text-muted-foreground">
                Référent : {nameOf(p.owner_id)} · {p.progress_percent}%
                {p.deadline ? ` · échéance ${formatDate(p.deadline)}` : ""}
              </p>
            </div>
          ))}
        </Block>

        <Block icon={Users} title="Qui fait quoi ?" empty={inProgress.length === 0}>
          {inProgress.slice(0, 15).map((t) => (
            <Row
              key={t.id}
              main={t.title}
              sub={`${nameOf(t.assigned_user_id)} · ${TASK_STATUS_LABEL[t.status] ?? t.status}`}
              right={t.deadline ? formatDate(t.deadline) : undefined}
              to="/tasks"
            />
          ))}
        </Block>

        <Block
          icon={HelpCircle}
          title="Quelles tâches ont besoin d'aide ?"
          hint="Signaler un blocage est un appui demandé au collectif, jamais un échec."
          empty={blocked.length === 0}
          emptyLabel="Aucun besoin d'aide signalé pour le moment."
        >
          {blocked.map((t) => (
            <Row key={t.id} main={t.title} sub={nameOf(t.assigned_user_id)} right="Besoin d'aide" to="/tasks" />
          ))}
        </Block>

        <Block
          icon={ShieldCheck}
          title="Quelles actions doivent être validées ?"
          hint="Validez ou renvoyez directement ici : le commentaire est obligatoire et rejoint l'historique."
          empty={toValidate.length === 0}
        >
          {toValidate.map((t) => (
            <QuickValidationRow
              key={t.id}
              task={{
                id: t.id,
                title: t.title,
                submitted_at: t.submitted_at,
                assignee: nameOf(t.assigned_user_id),
              }}
            />
          ))}
        </Block>


        <Block icon={Sparkles} title="Quelles actions sont terminées ?" empty={doneTasks.length === 0}>
          {doneTasks.slice(0, 12).map((t) => (
            <Row key={t.id} main={t.title} sub={nameOf(t.assigned_user_id)} right="Validée" to="/tasks" />
          ))}
        </Block>

        <Block icon={FolderKanban} title="Quels projets avancent cette semaine ?" empty={movingProjects.length === 0}>
          {movingProjects.map((p) => (
            <Row key={p.id} main={p.title} sub={`${p.progress_percent}% · maj ${formatDate(p.updated_at)}`} to={`/projects/${p.id}`} />
          ))}
        </Block>

        <Block icon={CalendarRange} title="Quels événements arrivent ?" empty={upcomingEvents.length === 0}>
          {upcomingEvents.map((e) => (
            <Row
              key={e.id}
              main={e.title}
              sub={`${e.event_type} · ${e.start_date ? formatDate(e.start_date) : "date à définir"}`}
              right={e.status}
              to={`/events/${e.id}`}
            />
          ))}
        </Block>

        <Block icon={CalendarRange} title="Quelles activités sont programmées ?" empty={upcomingActivities.length === 0}>
          {upcomingActivities.map((a) => (
            <Row
              key={a.id}
              main={a.title}
              sub={`${a.type} · ${a.date ? formatDate(a.date) : "date à définir"}`}
              right={a.capacity ? `${a.capacity} places` : undefined}
              to={`/activities/${a.id}`}
            />
          ))}
        </Block>

        <Block icon={Users} title="Qui participe ?" empty={participantIds.size === 0}>
          <Row main="Professionnels inscrits" right={String(proParticipants.length)} />
          {proParticipants.slice(0, 8).map((id) => (
            <Row key={id} main={nameOf(id)} sub="Professionnel" />
          ))}
          <Row main="Particuliers inscrits" right={String(privateParticipants.length)} />
          {privateParticipants.slice(0, 8).map((id) => (
            <Row key={id} main={nameOf(id)} sub="Particulier" />
          ))}
        </Block>

        <Block
          icon={ListChecks}
          title="Quels bénévoles peuvent aider ?"
          hint="Tâches ouvertes à qui veut contribuer, à son niveau."
          empty={volunteerTasks.length === 0}
        >
          {volunteerTasks.map((t) => (
            <Row key={t.id} main={t.title} sub="Tâche bénévole non attribuée" right={t.priority} />
          ))}
        </Block>

        <Block icon={Handshake} title="Quels partenaires sont actifs ?" empty={activePartners.length === 0}>
          {activePartners.map((p) => (
            <Row key={p.id} main={p.name} sub={p.type} />
          ))}
        </Block>

        <Block icon={Landmark} title="Quels projets avec des mairies sont en cours ?" empty={mairieProjects.length === 0}>
          {mairieProjects.map((m) => (
            <Row key={m.id} main={m.organization} sub={m.city ?? "Ville non précisée"} right={m.status} />
          ))}
        </Block>

        <Block icon={Newspaper} title="Quels contenus sont en préparation ?" empty={draftPosts.length === 0}>
          {draftPosts.map((p) => (
            <Row key={p.id} main={p.title} sub={`maj ${formatDate(p.updated_at)}`} right={p.status} />
          ))}
        </Block>

        <Block icon={Lightbulb} title="Quels professionnels proposent des idées ?" empty={newProposals.length === 0}>
          {newProposals.map((p) => (
            <Row key={p.id} main={p.title} sub={`${nameOf(p.submitted_by)} · ${p.type}`} right="À étudier" />
          ))}
        </Block>

        <Block icon={Euro} title="Quelles sommes doivent être versées ?" empty={false}>
          <Row main="Part professionnels cumulée" right={`${dueToPros.toFixed(2)} €`} />
          <Row
            main="Remboursements à effectuer"
            sub={`${pendingRefunds.length} demande(s) en attente`}
            right={`${pendingRefunds.reduce((s, r) => s + Number(r.amount), 0).toFixed(2)} €`}
          />
          {pendingRefunds.map((r) => (
            <Row key={r.id} main={r.label} sub={nameOf(r.person_id)} right={`${Number(r.amount).toFixed(2)} €`} />
          ))}
        </Block>

        <Block
          icon={Package}
          title="Quelles ressources nécessitent une attention ?"
          empty={lowStock.length === 0}
          emptyLabel="Tous les stocks sont au-dessus du seuil d'alerte."
        >
          {lowStock.map((i) => (
            <Row
              key={i.id}
              main={i.name}
              sub={i.location ?? "Emplacement non précisé"}
              right={`${i.quantity} / seuil ${i.alert_threshold}`}
            />
          ))}
        </Block>
      </div>
    </AppShell>
  );
}

function Block({
  icon: Icon,
  title,
  hint,
  children,
  empty,
  emptyLabel = "Rien à signaler.",
}: {
  icon: typeof FolderKanban;
  title: string;
  hint?: string;
  children: ReactNode;
  empty: boolean;
  emptyLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
      <CardContent className="max-h-72 space-y-2 overflow-y-auto text-sm">
        {empty ? <p className="text-muted-foreground">{emptyLabel}</p> : children}
      </CardContent>
    </Card>
  );
}

function Row({ main, sub, right, to }: { main: string; sub?: string | undefined; right?: string | undefined; to?: string }) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium">{main}</p>
        {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {right ? (
        <span className="shrink-0 text-xs text-muted-foreground">{right}</span>
      ) : (
        <AlertTriangle className="hidden" />
      )}
    </>
  );
  return to ? (
    <Link to={to} className="flex min-h-11 items-center justify-between gap-3 border-b border-border pb-2 hover:text-primary last:border-0">{content}</Link>
  ) : (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border pb-2 last:border-0">{content}</div>
  );
}
