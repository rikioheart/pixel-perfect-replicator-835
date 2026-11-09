import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CalendarClock, CalendarRange, ChevronRight, Compass, Euro, FolderKanban, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSensitiveRights } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { AG_CONVOCATION_DAYS, AG_QUORUM, convocationDeadline, isInAgMonth, nextAgYear } from "@/lib/statutes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/domain";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { euro, summarizePayouts, summarizeReimbursements } from "@/lib/finance-status";
import { PendingActionsStrip } from "@/components/PendingActionsStrip";
import { isOverdueReservation } from "@/lib/role-home";

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
      const [profiles, tasks, events, activities, proposals, inventory, offers, loans] = await Promise.all([
        supabase.from("profiles").select("id, display_name, first_name, last_name, membership_type, membership_status"),
        supabase.from("tasks").select("id, title, status, priority, needs_help, is_volunteer_task, deadline, assigned_user_id, submitted_at").not("status", "in", "(COMPLETED,ARCHIVED)"),
        supabase.from("events").select("id, title, start_date, event_type").gte("start_date", today).order("start_date").limit(6),
        supabase.from("activities").select("id, title, date, type").gte("date", today).order("date").limit(6),
        supabase.from("professional_proposals").select("id, title, type, submitted_by").eq("status", "PENDING"),
        supabase.from("inventory").select("id, name, quantity, alert_threshold, location"),
        supabase.from("contributions").select("id", { count: "exact", head: true }).in("status", ["PROPOSED", "DISCUSSION"]),
        supabase.from("inventory_reservations").select("status, end_date").eq("status", "ACTIVE").lt("end_date", today),
      ]);
      return {
        profiles: rows(profiles),
        tasks: rows(tasks),
        events: rows(events),
        activities: rows(activities),
        proposals: rows(proposals),
        inventory: rows(inventory),
        offers: offers.error ? null : (offers.count ?? 0),
        overdueLoans: loans.error ? null : (loans.data ?? []).filter((r) => isOverdueReservation(r, today)).length,
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
  const tasks = data?.tasks;
  const toValidate = tasks?.filter((t) => t.status === "PENDING_VALIDATION") ?? null;
  const helpNeeded = tasks?.filter((t) => t.needs_help) ?? null;
  const inProgress = tasks?.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO") ?? null;
  const lowStock = data?.inventory?.filter((i) => i.quantity <= i.alert_threshold) ?? null;
  const upcoming = [
    ...(data?.events ?? []).map((e) => ({ id: e.id, title: e.title, date: e.start_date, kind: e.event_type, to: `/events/${e.id}` })),
    ...(data?.activities ?? []).map((a) => ({ id: a.id, title: a.title, date: a.date, kind: a.type, to: `/activities/${a.id}` })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 8);

  const fin = finance.data;
  const rsum = fin?.reimb ? summarizeReimbursements(fin.reimb) : null;
  const psum = fin?.acc ? summarizePayouts(fin.acc) : null;
  const pendingCount = fin?.reimb?.filter((r) => r.status === "PENDING").length;
  const money = (v: number | undefined) => (v == null || finance.isError ? "—" : euro(v));
  const len = (list: unknown[] | null | undefined) => (list == null ? null : list.length);

  // Alertes : uniquement ce qui attend une décision ; chaque ligne mène à l'écran qui la traite.
  const actions = [
    { key: "members", label: "Adhésions à valider", count: len(profiles?.filter((p) => p.membership_status === "PENDING")), to: "/admin/gouvernance" },
    { key: "tasks", label: "Tâches en attente de clôture", count: len(toValidate), to: "/admin/validation" },
    { key: "offers", label: "Propositions d'aide à orienter", count: data ? data.offers : 0, to: "/admin/contributions" },
    { key: "loans", label: "Matériel non rendu", count: data ? data.overdueLoans : 0, to: "/inventory" },
    { key: "stock", label: "Stocks sous le seuil d'alerte", count: len(lowStock), to: "/inventory" },
    ...(canReimb ? [{ key: "reimb", label: "Remboursements à décider", count: finance.isError ? null : finance.data ? (pendingCount ?? null) : 0, to: "/finance" }] : []),
    { key: "proposals", label: "Propositions des professionnels", count: len(data?.proposals), to: "/proposals" },
    { key: "help", label: "Besoins d'aide signalés", count: len(helpNeeded), to: "/help-requests" },
  ];

  // « Qui fait quoi » compact : une ligne par personne, nombre de tâches et la plus proche échéance.
  const whoDoesWhat = inProgress
    ? [...inProgress.reduce((map, t) => {
        const key = t.assigned_user_id ?? "";
        const entry = map.get(key) ?? { id: key, count: 0, next: t };
        entry.count += 1;
        if (t.deadline && (!entry.next.deadline || t.deadline < entry.next.deadline)) entry.next = t;
        map.set(key, entry);
        return map;
      }, new Map<string, { id: string; count: number; next: (typeof inProgress)[number] }>()).values()]
        .sort((a, b) => b.count - a.count)
    : null;

  const shortcuts = [
    { label: "Besoins de décision & émargement AG", to: "/admin/gouvernance" },
    { label: "Inventaire", to: "/inventory" },
    { label: "Annuaire", to: "/directory" },
    { label: "Rôles & habilitations", to: "/admin/roles" },
    { label: "Historique", to: "/admin/audit" },
    { label: "Paramètres", to: "/admin/settings" },
  ];

  return (
    <AppShell title="Console du Bureau" subtitle="Le pilotage de l'association, en un coup d'œil">
      <BureauConsoleTabs />
      <PendingActionsStrip items={actions} loading={!data} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {rights.viewGlobal || canReimb ? (
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Euro className="size-4 text-primary" aria-hidden />Montants en attente de versement</CardTitle>
              <p className="text-xs text-muted-foreground">Deux sources distinctes, jamais additionnées.</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {canReimb ? (
                <>
                  <Row main="Remboursements à décider" sub={pendingCount == null ? undefined : `${pendingCount} demande(s)`} right={money(rsum?.pending)} to="/finance" />
                  <Row main="Remboursements approuvés, à payer" right={money(rsum?.approved)} to="/finance" />
                </>
              ) : null}
              {rights.viewGlobal ? (
                <Row main="Reversements professionnels à payer" right={money(psum?.due)} to="/finance" />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Block icon={CalendarRange} title="Prochains rendez-vous" list={data ? upcoming : null} emptyLabel="Aucun événement ni activité programmé." badge={false}>
          {upcoming.map((u) => <Row key={u.id} main={u.title} sub={`${u.kind} · ${u.date ? formatDate(u.date) : "date à définir"}`} to={u.to} />)}
        </Block>

        <Block icon={Users} title="Qui fait quoi ?" hint="Tâches en cours, par personne." list={whoDoesWhat} emptyLabel="Aucune tâche en cours." badge={false}>
          {whoDoesWhat?.slice(0, 8).map((w) => (
            <Row
              key={w.id || "none"}
              main={nameOf(w.id || null)}
              sub={`${w.next.title}${w.count > 1 ? ` et ${w.count - 1} autre(s)` : ""}`}
              right={w.next.deadline ? formatDate(w.next.deadline) : `${w.count} tâche(s)`}
              to="/tasks"
            />
          ))}
        </Block>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Compass className="size-4 text-primary" aria-hidden />Raccourcis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {shortcuts.map((s) => (
              <Link key={s.to} to={s.to} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="truncate">{s.label}</span>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ag-title" className="flex items-center gap-2 text-lg">
          <CalendarClock className="size-5 text-primary" aria-hidden /> Assemblée générale ordinaire {year}
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/gouvernance">Ouvrir l'émargement</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Article 16 : AG en juin, convocation au moins {AG_CONVOCATION_DAYS} jours avant, quorum de {AG_QUORUM} personnes
        présentes ou représentées. L'émargement nominatif calcule le quorum.
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
