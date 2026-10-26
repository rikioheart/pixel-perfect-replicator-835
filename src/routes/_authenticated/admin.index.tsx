import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Briefcase,
  CalendarClock,
  CalendarRange,
  Euro,
  FolderKanban,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Package,
  ShieldCheck,
  Users,
  Compass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSensitiveRights } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { AG_CONVOCATION_DAYS, AG_QUORUM, convocationDeadline, isInAgMonth, nextAgYear, quorumReached } from "@/lib/statutes";
import { CharterBanner } from "@/components/CharterBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TASK_STATUS_LABEL, formatDate } from "@/lib/domain";
import { NewsFeed } from "@/components/NewsFeed";
import { PendingMembersQueue } from "@/components/PendingMembersQueue";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { QuickValidationRow } from "@/components/QuickValidation";
import { euro, summarizePayouts, summarizeReimbursements } from "@/lib/finance-status";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Console du Bureau — La Voix du Chien" },
      {
        name: "description",
        content:
          "Console unique du Bureau : adhésions à valider, actions en attente, projets, besoins d'aide, agenda et synthèse financière.",
      },
      { property: "og:title", content: "Console du Bureau — La Voix du Chien" },
      {
        property: "og:description",
        content: "Tout ce qui demande une action du Bureau, sur une seule page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminConsole,
});

type Res<T> = { data: T[] | null; error: unknown };
/** null = requête refusée ou en échec : affiché « — », jamais un faux zéro. */
const rows = <T,>(r: Res<T>): T[] | null => (r.error ? null : (r.data ?? []));

function AdminConsole() {
  const { isBureau, roles, loading } = useAuth();
  const rights = useSensitiveRights();
  const canReimb = rights.viewGlobal || rights.validateReimbursements || rights.markPaid;

  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: isBureau,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [profiles, projects, tasks, events, activities, proposals, inventory, partners, mairies, posts] = await Promise.all([
        supabase.from("profiles").select("id, display_name, first_name, last_name, membership_type, membership_status"),
        supabase.from("projects").select("id, title, status, progress_percent, deadline, owner_id").eq("status", "ACTIVE").order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("tasks").select("id, title, status, priority, needs_help, is_volunteer_task, deadline, assigned_user_id, submitted_at").not("status", "in", "(COMPLETED,ARCHIVED)"),
        supabase.from("events").select("id, title, start_date, event_type").gte("start_date", today).order("start_date").limit(6),
        supabase.from("activities").select("id, title, date, type").gte("date", today).order("date").limit(6),
        supabase.from("professional_proposals").select("id, title, type, submitted_by").eq("status", "PENDING"),
        supabase.from("inventory").select("id, name, quantity, alert_threshold, location"),
        supabase.from("partners").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("mairies").select("id", { count: "exact", head: true }).neq("status", "CLOSED"),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }).neq("status", "PUBLISHED"),
      ]);
      return {
        profiles: rows(profiles),
        projects: rows(projects),
        tasks: rows(tasks),
        events: rows(events),
        activities: rows(activities),
        proposals: rows(proposals),
        inventory: rows(inventory),
        partners: partners.error ? null : (partners.count ?? 0),
        mairies: mairies.error ? null : (mairies.count ?? 0),
        posts: posts.error ? null : (posts.count ?? 0),
      };
    },
  });

  // Synthèse financière : chargée seulement avec un droit financier explicite. Sources distinctes, jamais additionnées.
  const finance = useQuery({
    queryKey: ["admin-dashboard-finance", rights.viewGlobal, canReimb],
    enabled: rights.ready && (rights.viewGlobal || canReimb),
    queryFn: async () => {
      const [reimb, acc] = await Promise.all([
        canReimb ? supabase.from("reimbursements").select("amount, status") : Promise.resolve({ data: null, error: "no-right" }),
        rights.viewGlobal
          ? supabase.from("accounting").select("professional_share, professional_paid_at").gt("professional_share", 0).not("professional_id", "is", null)
          : Promise.resolve({ data: null, error: "no-right" }),
      ]);
      return { reimb: rows(reimb as Res<{ amount: number; status: string }>), acc: rows(acc as Res<{ professional_share: number; professional_paid_at: string | null }>) };
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

  const profiles = data?.profiles;
  const nameOf = (id?: string | null) => {
    if (!id) return "Non attribué";
    const p = profiles?.find((x) => x.id === id);
    return p?.display_name || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Membre";
  };
  const active = profiles?.filter((p) => p.membership_status === "ACTIVE") ?? null;
  const tasks = data?.tasks;
  const toValidate = tasks?.filter((t) => t.status === "PENDING_VALIDATION") ?? null;
  const helpNeeded = tasks?.filter((t) => t.needs_help) ?? null;
  const inProgress = tasks?.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO") ?? null;
  const volunteer = tasks?.filter((t) => t.is_volunteer_task && !t.assigned_user_id) ?? null;
  const projects = data?.projects ?? null;
  const lowStock = data?.inventory?.filter((i) => i.quantity <= i.alert_threshold) ?? null;
  const upcoming = [
    ...(data?.events ?? []).map((e) => ({ id: e.id, title: e.title, date: e.start_date, kind: e.event_type, to: `/events/${e.id}` })),
    ...(data?.activities ?? []).map((a) => ({ id: a.id, title: a.title, date: a.date, kind: a.type, to: `/activities/${a.id}` })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 8);
  const n = (list: unknown[] | null | undefined) => (list == null ? "—" : String(list.length));
  const count = (v: number | null | undefined) => (v == null ? "—" : String(v));

  const kpis = [
    { label: "Membres actifs", value: n(active), icon: Users, to: "/directory" },
    { label: "Professionnels actifs", value: n(active?.filter((p) => p.membership_type === "PROFESSIONNEL")), icon: Briefcase, to: "/directory" },
    { label: "Particuliers actifs", value: n(active?.filter((p) => p.membership_type === "PARTICULIER")), icon: Users, to: "/directory" },
    { label: "Projets actifs", value: n(projects), icon: FolderKanban, to: "/projects" },
    { label: "Tâches à valider", value: n(toValidate), icon: ShieldCheck, to: "/admin/validation" },
    { label: "Besoins d'aide", value: n(helpNeeded), icon: HelpCircle, to: "/help-requests" },
  ];

  const fin = finance.data;
  const rsum = fin?.reimb ? summarizeReimbursements(fin.reimb) : null;
  const psum = fin?.acc ? summarizePayouts(fin.acc) : null;
  const pendingCount = fin?.reimb?.filter((r) => r.status === "PENDING").length;
  const money = (v: number | undefined) => (v == null || finance.isError ? "—" : euro(v));

  return (
    <AppShell
      title="Console du Bureau"
      subtitle="Ce qui demande une action, en un coup d'œil"
      actions={
        <Button asChild variant="secondary">
          <Link to="/admin/validation">Validations en attente</Link>
        </Button>
      }
    >
      <BureauConsoleTabs />
      <PendingMembersQueue />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.to} className="panel block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wide">{kpi.label}</span>
              <kpi.icon className="size-4" aria-hidden />
            </div>
            <p className="mt-2 font-display text-3xl">{kpi.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Block
          icon={ShieldCheck}
          title="Actions à valider"
          hint="Validez ou renvoyez directement ici : le commentaire est obligatoire et rejoint l'historique."
          list={toValidate}
        >
          {toValidate?.map((t) => (
            <QuickValidationRow key={t.id} task={{ id: t.id, title: t.title, submitted_at: t.submitted_at, assignee: nameOf(t.assigned_user_id) }} />
          ))}
        </Block>

        <Block
          icon={HelpCircle}
          title="Besoins d'aide"
          hint="Signaler un blocage est un appui demandé au collectif, jamais un échec."
          list={helpNeeded}
          emptyLabel="Aucun besoin d'aide signalé pour le moment."
        >
          {helpNeeded?.map((t) => <Row key={t.id} main={t.title} sub={nameOf(t.assigned_user_id)} right="Besoin d'aide" to="/tasks" />)}
        </Block>

        <Block icon={FolderKanban} title="Projets actifs" list={projects} emptyLabel="Aucun projet actif pour le moment.">
          {projects?.map((p) => (
            <div key={p.id} className="space-y-1 border-b border-border pb-2 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="truncate font-medium hover:underline">{p.title}</Link>
                <span className="shrink-0 text-xs text-muted-foreground">{p.progress_percent ?? 0}%</span>
              </div>
              <Progress value={p.progress_percent ?? 0} />
              <p className="text-xs text-muted-foreground">
                Référent : {nameOf(p.owner_id)}{p.deadline ? ` · échéance ${formatDate(p.deadline)}` : ""}
              </p>
            </div>
          ))}
        </Block>

        <Block icon={Users} title="Qui fait quoi ?" list={inProgress}>
          {inProgress?.slice(0, 12).map((t) => (
            <Row key={t.id} main={t.title} sub={`${nameOf(t.assigned_user_id)} · ${TASK_STATUS_LABEL[t.status] ?? t.status}`} right={t.deadline ? formatDate(t.deadline) : undefined} to="/tasks" />
          ))}
        </Block>

        <Block icon={ListChecks} title="Tâches ouvertes aux bénévoles" hint="À qui veut contribuer, à son niveau." list={volunteer}>
          {volunteer?.map((t) => <Row key={t.id} main={t.title} sub="Non attribuée" right={t.priority} to="/tasks" />)}
        </Block>

        <Block icon={CalendarRange} title="À venir" list={data ? upcoming : null} emptyLabel="Aucun événement ni activité programmé.">
          {upcoming.map((u) => <Row key={u.id} main={u.title} sub={`${u.kind} · ${u.date ? formatDate(u.date) : "date à définir"}`} to={u.to} />)}
        </Block>

        <Block icon={Lightbulb} title="Propositions des professionnels" list={data?.proposals ?? null}>
          {data?.proposals?.map((p) => <Row key={p.id} main={p.title} sub={`${nameOf(p.submitted_by)} · ${p.type}`} right="À étudier" to="/proposals" />)}
        </Block>

        {rights.viewGlobal || canReimb ? (
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Euro className="size-4 text-primary" aria-hidden />Sommes à verser</CardTitle>
              <p className="text-xs text-muted-foreground">Deux sources distinctes, jamais additionnées : demandes de remboursement et lignes comptables.</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {canReimb ? (
                <>
                  <Row main="Remboursements en attente de décision" sub={pendingCount == null ? undefined : `${pendingCount} demande(s) · source : remboursements`} right={money(rsum?.pending)} to="/finance" />
                  <Row main="Remboursements approuvés, à payer" right={money(rsum?.approved)} to="/finance" />
                  <Row main="Remboursements payés" right={money(rsum?.paid)} to="/finance" />
                </>
              ) : null}
              {rights.viewGlobal ? (
                <>
                  <Row main="Reversements professionnels à payer" sub="Source : lignes comptables" right={money(psum?.due)} to="/finance" />
                  <Row main="Reversements professionnels payés" right={money(psum?.paid)} to="/finance" />
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Block icon={Package} title="Ressources à surveiller" list={lowStock} emptyLabel="Tous les stocks sont au-dessus du seuil d'alerte.">
          {lowStock?.map((i) => <Row key={i.id} main={i.name} sub={i.location ?? "Emplacement non précisé"} right={`${i.quantity} / seuil ${i.alert_threshold}`} to="/inventory" />)}
        </Block>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Compass className="size-4 text-primary" aria-hidden />Raccourcis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row main="Partenaires actifs" right={count(data?.partners)} to="/directory" />
            <Row main="Projets avec des mairies en cours" right={count(data?.mairies)} to="/mairies" />
            <Row main="Contenus en préparation" right={count(data?.posts)} to="/blog" />
            <Row main="Rôles et habilitations" to="/admin/roles" />
            <Row main="Journal d'activité" to="/admin/audit" />
            <Row main="Paramètres" to="/admin/settings" />
          </CardContent>
        </Card>
      </div>

      <AgReminder />

      <div className="mt-6">
        <CharterBanner />
        <NewsFeed />
      </div>
    </AppShell>
  );
}

function Block({
  icon: Icon,
  title,
  hint,
  children,
  list,
  emptyLabel = "Rien à signaler.",
}: {
  icon: typeof FolderKanban;
  title: string;
  hint?: string;
  children: ReactNode;
  list: unknown[] | null | undefined;
  emptyLabel?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
          {list && list.length > 0 ? <Badge className="ml-auto border-transparent bg-warning text-warning-foreground hover:bg-warning" aria-label={`${list.length} en attente`}>{list.length}</Badge> : null}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
      <CardContent className="max-h-72 space-y-2 overflow-y-auto text-sm">
        {list === undefined ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : list === null ? (
          <p className="text-destructive">Indisponible (chargement ou droits).</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground">{emptyLabel}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function Row({ main, sub, right, to }: { main: string; sub?: string | undefined; right?: string | undefined; to?: string }) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{main}</p>
        {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {right ? <span className="shrink-0 text-xs text-muted-foreground">{right}</span> : null}
    </>
  );
  return to ? (
    <Link to={to} className="flex min-h-11 items-center justify-between gap-3 border-b border-border pb-2 hover:text-primary last:border-0">{content}</Link>
  ) : (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border pb-2 last:border-0">{content}</div>
  );
}

function AgReminder() {
  const year = nextAgYear(new Date());
  const [agDate, setAgDate] = useState(`${year}-06-20`);
  const [present, setPresent] = useState(0);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(agDate);
  return (
    <section className="panel mt-6 space-y-3 p-5" aria-labelledby="ag-title">
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
