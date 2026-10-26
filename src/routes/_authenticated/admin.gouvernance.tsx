import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSensitiveRights } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { GovernanceRegister } from "@/components/GovernanceRegister";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/domain";
import { contributionBucket, priorityOf, sortGov, terrainBucket, type GovBucket, type GovItem } from "@/lib/governance";

export const Route = createFileRoute("/_authenticated/admin/gouvernance")({
  head: () => ({
    meta: [
      { title: "Besoins de décision — Bureau La Voix du Chien" },
      { name: "description", content: "Décisions à prendre, sujets à arbitrer et suivi des décisions du Bureau, avec renvoi vers chaque dossier d'origine." },
      { property: "og:title", content: "Besoins de décision du Bureau" },
      { property: "og:description", content: "Vue de gouvernance réservée au Bureau : décisions, arbitrages et suivi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GovernancePage,
});

type Res<T> = { data: T[] | null; error: unknown };
const rows = <T,>(r: Res<T>): T[] | null => (r.error ? null : (r.data ?? []));
const count = (r: { count: number | null; error: unknown }) => (r.error ? null : (r.count ?? 0));

const BUCKETS: { code: GovBucket; title: string; empty: string }[] = [
  { code: "decide", title: "Décisions à prendre", empty: "Aucune décision en attente du Bureau." },
  { code: "arbitrage", title: "En attente d'arbitrage", empty: "Aucun sujet bloqué ou en discussion." },
  { code: "followup", title: "Décisions prises — suivi", empty: "Aucune décision récente à suivre." },
];

const PROPOSAL_STATE: Record<string, string> = { PENDING: "À examiner", APPROVED: "Acceptée", REJECTED: "Refusée" };
const CONTRIB_STATE: Record<string, string> = { PROPOSED: "Proposée", DISCUSSION: "En discussion", BLOCKED: "Bloquée", ACCEPTED: "Acceptée", IN_PROGRESS: "En cours" };
const TERRAIN_STATE: Record<string, string> = { PENDING: "À décider", CHANGES_REQUESTED: "Modifications demandées", APPROVED: "Acceptée" };

function GovernancePage() {
  const { isBureau, loading } = useAuth();
  const rights = useSensitiveRights();
  const canReimb = rights.viewGlobal || rights.validateReimbursements || rights.markPaid;
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["governance", today],
    enabled: isBureau,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [members, tasks, proposals, decided, contribs, terrain, help] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "PENDING"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "PENDING_VALIDATION"),
        supabase.from("professional_proposals").select("id, title, type, status, created_at").eq("status", "PENDING"),
        supabase.from("professional_proposals").select("id, title, type, status, reviewed_by, updated_at").in("status", ["APPROVED", "REJECTED"]).gte("updated_at", since30),
        supabase.from("contributions").select("id, title, contribution_type, status, created_at, updated_at, projects(title)").in("status", ["PROPOSED", "DISCUSSION", "BLOCKED", "ACCEPTED", "IN_PROGRESS"]),
        supabase.from("terrain_reservations").select("id, purpose, status, date, created_at, reviewed_by, terrain_resources(name)").in("status", ["PENDING", "CHANGES_REQUESTED", "APPROVED"]),
        supabase.from("help_requests").select("id, type, status, created_at, handled_by").eq("status", "OPEN"),
      ]);
      const owners = new Set<string>();
      for (const r of rows(decided) ?? []) if (r.reviewed_by) owners.add(r.reviewed_by);
      for (const r of rows(terrain) ?? []) if (r.reviewed_by) owners.add(r.reviewed_by);
      const names = owners.size
        ? (await supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", [...owners])).data ?? []
        : [];
      return {
        members: count(members),
        tasks: count(tasks),
        proposals: rows(proposals),
        decided: rows(decided),
        contribs: rows(contribs),
        terrain: rows(terrain),
        help: rows(help),
        names,
      };
    },
  });

  // Remboursements : comptage seulement, et seulement avec un droit financier explicite.
  const reimb = useQuery({
    queryKey: ["governance-reimb", canReimb],
    enabled: rights.ready && canReimb,
    queryFn: async () => {
      const [pending, toPay] = await Promise.all([
        supabase.from("reimbursements").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("reimbursements").select("id", { count: "exact", head: true }).eq("status", "APPROVED"),
      ]);
      return { pending: count(pending), toPay: count(toPay) };
    },
  });

  if (!loading && !isBureau) {
    return (
      <AppShell title="Besoins de décision" subtitle="Accès réservé aux membres du Bureau">
        <p className="panel max-w-xl p-6 text-sm text-muted-foreground">Cet écran est réservé aux membres du Bureau.</p>
      </AppShell>
    );
  }

  const nameOf = (id?: string | null) => {
    if (!id) return null;
    const p = data?.names.find((x) => x.id === id);
    return p?.display_name || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Membre du Bureau";
  };

  const items: GovItem[] = [];
  for (const p of data?.proposals ?? []) items.push({ key: `p-${p.id}`, source: "Proposition de professionnel", title: p.title, context: p.type, state: PROPOSAL_STATE[p.status] ?? p.status, bucket: "decide", since: p.created_at, action: "Accepter ou refuser la proposition", link: "/proposals" });
  for (const p of data?.decided ?? []) items.push({ key: `pd-${p.id}`, source: "Proposition de professionnel", title: p.title, context: p.type, state: PROPOSAL_STATE[p.status] ?? p.status, bucket: "followup", since: p.updated_at, owner: nameOf(p.reviewed_by), action: p.status === "APPROVED" ? "Mettre en œuvre et informer le professionnel" : "Décision communiquée", link: "/proposals" });
  for (const c of data?.contribs ?? []) {
    const bucket = contributionBucket(c.status);
    if (!bucket) continue;
    items.push({ key: `c-${c.id}`, source: "Proposition d'aide", title: c.title, context: c.projects?.title ?? c.contribution_type, state: CONTRIB_STATE[c.status] ?? c.status, bucket, since: bucket === "followup" ? c.updated_at : c.created_at, action: bucket === "decide" ? "Répondre à la proposition" : bucket === "arbitrage" ? "Trancher ou débloquer" : "Suivre la réalisation", link: "/admin/contributions" });
  }
  for (const t of data?.terrain ?? []) {
    const bucket = terrainBucket(t.status, t.date, today);
    if (!bucket) continue;
    items.push({ key: `t-${t.id}`, source: "Réservation du terrain", title: t.purpose || t.terrain_resources?.name || "Réservation", context: t.terrain_resources?.name, state: TERRAIN_STATE[t.status] ?? t.status, bucket, since: t.created_at, due: t.date, owner: nameOf(t.reviewed_by), action: bucket === "decide" ? "Accepter, refuser ou demander des modifications" : bucket === "arbitrage" ? "Attendre ou relancer le demandeur" : "Créneau confirmé", link: "/terrain" });
  }
  for (const h of data?.help ?? []) items.push({ key: `h-${h.id}`, source: "Demande d'aide", title: h.type, state: "Ouverte", bucket: "arbitrage", since: h.created_at, action: "Désigner une personne pour répondre", link: "/help-requests" });

  const sorted = sortGov(items, today);
  const queues = [
    { label: "Adhésions à valider", value: data?.members, to: "/admin", hint: "File unique des adhésions" },
    { label: "Tâches à valider", value: data?.tasks, to: "/admin/validation", hint: "Preuves soumises" },
    ...(canReimb ? [
      { label: "Remboursements à décider", value: reimb.data?.pending, to: "/finance", hint: "Droit financier requis" },
      { label: "Remboursements à payer", value: reimb.data?.toPay, to: "/finance", hint: "Droit financier requis" },
    ] : []),
  ];

  return (
    <AppShell title="Besoins de décision" subtitle="Ce que le Bureau doit trancher, et ce qui a été décidé">
      <BureauConsoleTabs />

      <section aria-labelledby="queues-title" className="mb-6">
        <h2 id="queues-title" className="mb-2 font-display text-lg">Validations courantes</h2>
        <p className="mb-3 text-xs text-muted-foreground">Ces dossiers se traitent dans leur file habituelle ; ils sont seulement signalés ici.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((q) => (
            <Link key={q.label} to={q.to as never} className="panel flex items-center justify-between gap-2 p-3 text-sm hover:bg-muted">
              <span><span className="block font-medium">{q.label}</span><span className="text-xs text-muted-foreground">{q.hint}</span></span>
              <span className="font-display text-xl">{q.value == null ? "—" : q.value}</span>
            </Link>
          ))}
        </div>
      </section>

      {isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement…</p> : (
        <div className="grid gap-5 xl:grid-cols-3">
          {BUCKETS.map((b) => {
            const list = sorted.filter((i) => i.bucket === b.code);
            return (
              <section key={b.code} aria-labelledby={`gov-${b.code}`} className="space-y-2">
                <h2 id={`gov-${b.code}`} className="flex items-center justify-between font-display text-lg">{b.title}{list.length > 0 ? <Badge className="border-transparent bg-warning text-warning-foreground hover:bg-warning">{list.length}</Badge> : null}</h2>
                {list.length === 0 ? <p className="panel p-4 text-sm text-muted-foreground">{b.empty}</p> : list.map((i) => {
                  const urgent = priorityOf(i, today) === "URGENTE";
                  return (
                    <article key={i.key} className="panel space-y-1 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline">{i.source}</Badge>
                        <Badge variant={urgent ? "destructive" : "secondary"}>{urgent ? "Prioritaire" : "Normale"}</Badge>
                      </div>
                      <h3 className="font-medium">{i.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {i.state}{i.context ? ` · ${i.context}` : ""} · depuis le {formatDate(i.since)}
                        {i.due ? ` · échéance ${formatDate(i.due)}` : ""}
                        {i.owner ? ` · suivi : ${i.owner}` : ""}
                      </p>
                      <Link to={i.link as never} className="inline-flex items-center gap-1 text-xs font-medium underline">{i.action}<ArrowRight className="size-3" aria-hidden /></Link>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">Priorité calculée : échéance dans 7 jours ou moins, ou sujet en attente depuis 14 jours. Aucune donnée n'est copiée : chaque lien ouvre le dossier d'origine.</p>
      <GovernanceRegister />
    </AppShell>
  );
}
