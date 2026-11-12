import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CalendarClock, CalendarRange, ChevronRight, Compass, Euro, FolderKanban, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { AG_CONVOCATION_DAYS, AG_QUORUM, convocationDeadline, isInAgMonth, nextAgYear } from "@/lib/statutes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/domain";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { euro } from "@/lib/finance-status";
import { membershipStatus, parseConsoleSummary, pct, taskStatus, type Tone } from "@/lib/console-summary";
import { Progress } from "@/components/ui/progress";
import { PendingActionsStrip } from "@/components/PendingActionsStrip";
import { BureauQuickAccess } from "@/components/BureauQuickAccess";
import { InlineLoading } from "@/components/LoadingState";

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

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-transparent bg-success text-success-foreground hover:bg-success",
  warn: "border-transparent bg-warning text-warning-foreground hover:bg-warning",
  alert: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive",
  calm: "border-transparent bg-muted text-muted-foreground hover:bg-muted",
};

function AdminConsole() {
  const { isBureau, roles, loading } = useAuth();

  // Synthèse uniquement (compteurs, pourcentages, totaux) : aucune ligne nominative d'un autre membre n'est chargée ici.
  const { data, isError } = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: isBureau,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [summary, events, activities] = await Promise.all([
        supabase.rpc("bureau_console_summary"),
        supabase.from("events").select("id, title, start_date, event_type").gte("start_date", today).order("start_date").limit(6),
        supabase.from("activities").select("id, title, date, type").gte("date", today).order("date").limit(6),
      ]);
      if (summary.error) throw new Error(summary.error.message);
      return {
        summary: parseConsoleSummary(summary.data),
        events: rows(events),
        activities: rows(activities),
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

  const s = data?.summary;
  const fin = s?.finance ?? null;
  const upcoming = [
    ...(data?.events ?? []).map((e) => ({ id: e.id, title: e.title, date: e.start_date, kind: e.event_type, to: `/events/${e.id}` })),
    ...(data?.activities ?? []).map((a) => ({ id: a.id, title: a.title, date: a.date, kind: a.type, to: `/activities/${a.id}` })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 8);
  const money = (v: number | null | undefined) => (v == null ? "—" : euro(v));
  const n = (v: number | undefined) => (isError ? null : v ?? 0);

  // Alertes : uniquement ce qui attend une décision ; chaque ligne mène à l'écran qui la traite.
  const actions = [
    { key: "members", label: "Adhésions à valider", count: n(s?.members.pending), to: "/admin/gouvernance" },
    { key: "tasks", label: "Tâches en attente de clôture", count: n(s?.tasks.toValidate), to: "/admin/validation" },
    { key: "offers", label: "Propositions d'aide à orienter", count: n(s?.offers), to: "/admin/contributions" },
    { key: "loans", label: "Matériel non rendu", count: n(s?.inventory.overdueLoans), to: "/inventory" },
    { key: "stock", label: "Stocks sous le seuil d'alerte", count: n(s?.inventory.lowStock), to: "/inventory" },
    ...(fin && fin.reimbPendingCount != null
      ? [{ key: "reimb", label: "Remboursements à décider", count: fin.reimbPendingCount, to: "/finance" }]
      : []),
    { key: "proposals", label: "Propositions des professionnels", count: n(s?.proProposals), to: "/proposals" },
    { key: "help", label: "Besoins d'aide signalés", count: n(s?.tasks.needsHelp), to: "/help-requests" },
  ];

  const shortcuts = [
    { label: "Besoins de décision", to: "/admin/gouvernance" },
    { label: "Inventaire", to: "/inventory" },
    { label: "Annuaire", to: "/directory" },
    { label: "Rôles & habilitations", to: "/admin/roles" },
    { label: "Historique", to: "/admin/audit" },
    { label: "Paramètres", to: "/admin/settings" },
  ];

  const unavailable = <p className="text-sm text-destructive">Indisponible pour le moment.</p>;
  const pendingLoad = <InlineLoading />;

  return (
    <AppShell title="Console du Bureau" subtitle="Le pilotage de l'association, en un coup d'œil">
      <BureauConsoleTabs />
      <BureauQuickAccess ag={isError ? undefined : s ? s.ag : undefined} agError={isError} />
      <PendingActionsStrip items={actions} loading={!data && !isError} />

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
        Cette console n'affiche que des statuts, des pourcentages et des totaux : aucune donnée personnelle d'un membre.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" aria-hidden />Adhésions
              {s ? <StatusBadge {...membershipStatus(s.members)} /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isError ? unavailable : !s ? pendingLoad : (
              <>
                <Gauge
                  label="Adhésions actives"
                  value={pct(s.members.active, s.members.considered)}
                  detail={`${s.members.active} sur ${s.members.considered}`}
                />
                <Row main="Particuliers actifs" right={String(s.members.activeParticuliers)} />
                <Row main="Professionnels bienfaiteurs actifs" right={String(s.members.activePros)} />
                <Row main="Demandes en attente" right={String(s.members.pending)} to="/admin/gouvernance" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="size-4 text-primary" aria-hidden />Tâches & engagement
              {s ? <StatusBadge {...taskStatus(s.tasks)} /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isError ? unavailable : !s ? pendingLoad : (
              <>
                <Gauge
                  label="Tâches en cours confiées à quelqu'un"
                  value={pct(s.tasks.assigned, s.tasks.working)}
                  detail={`${s.tasks.assigned} sur ${s.tasks.working}`}
                />
                <Row
                  main="Tâches en retard"
                  right={s.tasks.working ? `${s.tasks.overdue} (${pct(s.tasks.overdue, s.tasks.working)} %)` : "0"}
                  to="/tasks"
                />
                <Row main="Personnes impliquées" right={String(s.tasks.peopleInvolved)} />
                <Row main="Besoins d'aide signalés" right={String(s.tasks.needsHelp)} to="/help-requests" />
              </>
            )}
          </CardContent>
        </Card>

        {fin ? (
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Euro className="size-4 text-primary" aria-hidden />Montants en attente de versement</CardTitle>
              <p className="text-xs text-muted-foreground">Totaux seulement. Deux sources distinctes, jamais additionnées.</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {fin.reimbPendingCount != null ? (
                <>
                  <Row main="Remboursements à décider" sub={`${fin.reimbPendingCount} demande(s)`} right={money(fin.reimbPendingAmount)} to="/finance" />
                  <Row main="Remboursements approuvés, à payer" right={money(fin.reimbApprovedAmount)} to="/finance" />
                </>
              ) : null}
              {fin.payoutsDueAmount != null ? (
                <Row main="Reversements professionnels à payer" right={money(fin.payoutsDueAmount)} to="/admin/suivi-financier" />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Block icon={CalendarRange} title="Prochains rendez-vous" list={data ? upcoming : isError ? null : undefined} emptyLabel="Aucun événement ni activité programmé." badge={false}>
          {upcoming.map((u) => <Row key={u.id} main={u.title} sub={`${u.kind} · ${u.date ? formatDate(u.date) : "date à définir"}`} to={u.to} />)}
        </Block>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Compass className="size-4 text-primary" aria-hidden />Raccourcis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {shortcuts.map((sc) => (
              <Link key={sc.to} to={sc.to} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="truncate">{sc.label}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <AgReminder />
    </AppShell>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <Badge className={`ml-auto shrink-0 ${TONE_CLASS[tone]}`}>{label}</Badge>;
}

function Gauge({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="font-display text-xl">{value == null ? "—" : `${value} %`}</span>
      </div>
      <Progress value={value ?? 0} aria-label={`${label} : ${value == null ? "aucune donnée" : `${value} %`}`} className="h-2" />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Block({
  icon: Icon,
  title,
  hint,
  children,
  list,
  emptyLabel = "Rien à signaler.",
  badge = true,
}: {
  icon: typeof FolderKanban;
  title: string;
  hint?: string;
  children: ReactNode;
  list: unknown[] | null | undefined;
  emptyLabel?: string;
  badge?: boolean;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
          {badge && list && list.length > 0 ? <Badge className="ml-auto border-transparent bg-warning text-warning-foreground hover:bg-warning" aria-label={`${list.length} en attente`}>{list.length}</Badge> : null}
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
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(agDate);
  return (
    <section className="panel mt-6 space-y-3 p-5" aria-labelledby="ag-title">
      <h2 id="ag-title" className="flex items-center gap-2 text-lg">
        <CalendarClock className="size-5 text-primary" aria-hidden /> Assemblée générale ordinaire {year}
      </h2>
      <p className="text-sm text-muted-foreground">
        Article 16 : AG en juin, convocation au moins {AG_CONVOCATION_DAYS} jours avant, quorum de {AG_QUORUM} personnes
        présentes ou représentées. L'émargement nominatif (accès rapide en haut de la Console) calcule le quorum.
      </p>
      <label className="block max-w-xs text-sm">
        Date envisagée
        <Input type="date" value={agDate} onChange={(e) => setAgDate(e.target.value)} className="mt-1" />
      </label>
      {valid ? (
        <ul className="space-y-1 text-sm">
          <li>Convocations à envoyer au plus tard le <strong>{new Date(convocationDeadline(agDate)).toLocaleDateString("fr-FR")}</strong>.</li>
          {!isInAgMonth(agDate) ? <li className="font-medium">Attention : cette date n'est pas en juin, comme le prévoient les statuts.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
