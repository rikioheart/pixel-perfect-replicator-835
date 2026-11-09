import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Copy, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSensitiveRights } from "@/lib/permissions";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { buildRows, toCsv, toTsv, parseHelloAssoCsv, EXPORT_COLUMNS } from "@/lib/finance-export";
import { LEDGER_CATEGORIES, categoryLabel } from "@/lib/annual-accounts";
import { AccountingSplitsPanel } from "@/components/AccountingSplitsPanel";
import { Link } from "@tanstack/react-router";

const TITLE = "Comptabilité & Grand livre";

export const Route = createFileRoute("/_authenticated/admin/suivi-financier")({
  head: () => ({
    meta: [
      { title: "Comptabilité & Grand livre — La Voix du Chien" },
      { name: "description", content: "Grand livre de l'association : recettes et dépenses, adhésions HelloAsso, répartitions et exports comptables." },
      { property: "og:title", content: "Comptabilité & Grand livre — La Voix du Chien" },
      { property: "og:description", content: "Suivi budgétaire global, recettes HelloAsso et exports pour le bilan de l'exercice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const STATUS_FR: Record<string, string> = { A_RECEVOIR: "À recevoir", RECU: "Reçu", A_PAYER: "À payer", PAYE: "Payé", TRANSMIS: "Transmis compta", ANNULE: "Annulé" };
const OUT_FR: Record<string, string> = { CREATED: "Créé", UPDATED: "Mis à jour", UNCHANGED: "Déjà connu", TO_REVIEW: "À valider", PERSON_ONLY: "Personne sans compte", ERROR: "Erreur", RESOLVED: "Traité", EXPORTED: "Exporté" };
const EMPTY = { entry_date: new Date().toISOString().slice(0, 10), direction: "RECETTE", category: "ADHESION", amount: "", description: "", status: "A_RECEVOIR", receipt_url: "", payment_method: "", external_ref: "", internal_note: "", project_id: "", activity_id: "", person_id: "" };

function Page() {
  // Requêtes lancées seulement si le droit est effectif ; la base refuse de toute façon (RLS).
  const rights = useSensitiveRights();
  const canJournal = rights.viewGlobal || rights.validateMembers;
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const [filter, setFilter] = useState("");

  const entries = useQuery({
    queryKey: ["finance-entries"],
    enabled: rights.viewGlobal,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_entries")
        .select("*, people(display_name, first_name, last_name), projects(title), activities(title)")
        .order("entry_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  // Rattachements facultatifs d'une opération (colonnes existantes de finance_entries, aucune autre table touchée).
  const links = useQuery({
    queryKey: ["finance-entry-links"],
    enabled: rights.create,
    queryFn: async () => {
      const [projects, activities, people] = await Promise.all([
        supabase.from("projects").select("id, title").order("title"),
        supabase.from("activities").select("id, title, date").order("date", { ascending: false }).limit(200),
        supabase.from("people").select("id, display_name, first_name, last_name").order("last_name"),
      ]);
      return { projects: projects.data ?? [], activities: activities.data ?? [], people: people.data ?? [] };
    },
  });
  const journal = useQuery({
    queryKey: ["integration-events"],
    enabled: canJournal,
    queryFn: async () => {
      const { data, error } = await supabase.from("integration_events").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["finance-entries"] }); void qc.invalidateQueries({ queryKey: ["integration-events"] }); };

  const add = useMutation({
    mutationFn: async (extra: Partial<Record<string, unknown>> = {}) => {
      const amount = Number(String(extra["amount"] ?? f.amount).replace(",", "."));
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Montant invalide.");
      const { error } = await supabase.from("finance_entries").insert({
        entry_date: f.entry_date, direction: f.direction, category: f.category, amount,
        description: f.description || null, status: f.status, receipt_url: f.receipt_url || null,
        payment_method: f.payment_method || null, external_ref: f.external_ref || null, internal_note: f.internal_note || null,
        project_id: f.project_id || null, activity_id: f.activity_id || null, person_id: f.person_id || null,
        ...extra,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Opération enregistrée."); setF(EMPTY); refresh(); },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Déjà suivi (pas de doublon)." : e.message.includes("row-level") ? "Droit « finances » requis." : e.message),
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("finance_entries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("integration_events").update({ outcome: "RESOLVED", resolved_by: u.user?.id ?? null, resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: (e: Error) => toast.error(e.message),
  });

  const importHelloAsso = async (file: File) => {
    const rows = parseHelloAssoCsv(await file.text());
    if (rows.length === 0) { toast.error("Aucune ligne lisible. Colonnes attendues : id, email, prenom, nom, debut, fin, montant."); return undefined; }
    if (!confirm(`Importer ${rows.length} adhésion(s) HelloAsso ?\nAucune fusion automatique : les cas ambigus seront mis « à valider ».`)) return undefined;
    const counts: Record<string, number> = {};
    for (const r of rows.slice(0, 1000)) {
      const { data, error } = await supabase.rpc("import_helloasso_membership", {
        _ext_id: r.id, _email: r.email, _first: r.prenom, _last: r.nom, _start: r.debut || null as never, _end: r.fin || null as never, _amount: r.montant,
      });
      const o = error ? "ERROR" : String((data as { outcome?: string })?.outcome ?? "ERROR");
      counts[o] = (counts[o] ?? 0) + 1;
    }
    toast.success(Object.entries(counts).map(([k, v]) => `${OUT_FR[k] ?? k} : ${v}`).join(" · "));
    refresh();
    return undefined;
  };

  const list = useMemo(() => (entries.data ?? []).filter((e) => !filter || e.status === filter || e.direction === filter), [entries.data, filter]);
  const rows = useMemo(() => buildRows(list as never), [list]);
  const totals = list.filter((e) => e.status !== "ANNULE").reduce((t, e) => {
    t[e.direction === "RECETTE" ? "in" : "out"] += Number(e.amount); return t; }, { in: 0, out: 0 });

  const download = () => {
    const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `grand-livre-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (!rights.ready) return <AppShell title={TITLE}><p role="status" className="text-sm text-muted-foreground">Vérification de vos droits…</p></AppShell>;
  if (!rights.viewGlobal) return <AppShell title={TITLE}><EmptyState title="Droit finances requis" message="Le grand livre est réservé aux membres du Bureau disposant du droit « consulter les finances globales »." /></AppShell>;
  const money = (n: number) => (entries.isError ? "—" : `${n.toFixed(2)} €`);

  return (
    <AppShell title={TITLE} subtitle="Suivi budgétaire global : recettes (dont HelloAsso), dépenses, répartitions et exports pour le bilan de l'exercice.">
      <BureauConsoleTabs />
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Recettes suivies</p><p className="text-xl font-bold">{money(totals.in)}</p><p className="text-xs text-muted-foreground">Grand livre, hors annulées</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Dépenses suivies</p><p className="text-xl font-bold">{money(totals.out)}</p><p className="text-xs text-muted-foreground">Notes de frais : voir <Link to="/finance" className="underline">Remboursements & Notes de frais</Link></p></div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
          <Button size="sm" onClick={download}><Download className="mr-1 size-3.5" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(toTsv(rows)); toast.success("Copié : collez directement dans Google Sheets ou un tableur."); }}><Copy className="mr-1 size-3.5" />Copier pour tableur</Button>
        </div>
      </section>

      {rights.create ? (
      <details className="mb-6 rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Ajouter une écriture au grand livre</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="fe-d">Date</Label><Input id="fe-d" type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} /></div>
          <div><Label htmlFor="fe-dir">Sens</Label>
            <select id="fe-dir" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.direction}
              onChange={(e) => setF({ ...f, direction: e.target.value, category: LEDGER_CATEGORIES[e.target.value as "RECETTE"][0].code, status: e.target.value === "RECETTE" ? "A_RECEVOIR" : "A_PAYER" })}>
              <option value="RECETTE">Recette</option><option value="DEPENSE">Dépense</option></select></div>
          <div><Label htmlFor="fe-cat">Catégorie</Label>
            <select id="fe-cat" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {LEDGER_CATEGORIES[f.direction as "RECETTE"].map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
          <div><Label htmlFor="fe-a">Montant (€)</Label><Input id="fe-a" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label htmlFor="fe-s">Statut</Label>
            <select id="fe-s" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><Label htmlFor="fe-pm">Mode de paiement</Label><Input id="fe-pm" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="fe-desc">Description</Label><Input id="fe-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label htmlFor="fe-ref">Référence</Label><Input id="fe-ref" value={f.external_ref} onChange={(e) => setF({ ...f, external_ref: e.target.value })} /></div>
          <div><Label htmlFor="fe-proj">Projet associé (facultatif)</Label>
            <select id="fe-proj" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
              <option value="">Aucun</option>{(links.data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div><Label htmlFor="fe-act">Activité associée (facultatif)</Label>
            <select id="fe-act" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.activity_id} onChange={(e) => setF({ ...f, activity_id: e.target.value })}>
              <option value="">Aucune</option>{(links.data?.activities ?? []).map((a) => <option key={a.id} value={a.id}>{a.date ? `${a.date} · ` : ""}{a.title}</option>)}</select></div>
          <div><Label htmlFor="fe-pers">Tiers ou bénéficiaire (facultatif)</Label>
            <select id="fe-pers" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.person_id} onChange={(e) => setF({ ...f, person_id: e.target.value })}>
              <option value="">Aucun</option>{(links.data?.people ?? []).map((p) => <option key={p.id} value={p.id}>{p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Personne"}</option>)}</select></div>
          <div className="sm:col-span-2"><Label htmlFor="fe-r">Lien du justificatif (facultatif)</Label><Input id="fe-r" placeholder="https://… (photo ou document)" value={f.receipt_url} onChange={(e) => setF({ ...f, receipt_url: e.target.value })} /></div>
          <div><Label htmlFor="fe-n">Note interne (facultatif)</Label><Input id="fe-n" value={f.internal_note} onChange={(e) => setF({ ...f, internal_note: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground sm:col-span-3">Ni la note ni le justificatif ne sont obligatoires pour enregistrer une opération.</p>
        </div>
        <Button className="mt-3" onClick={() => add.mutate({})} disabled={add.isPending}>Enregistrer</Button>
      </details>
      ) : null}


      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer">
        {["", "RECETTE", "DEPENSE", "A_RECEVOIR", "A_PAYER", "TRANSMIS"].map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k === "" ? "Tout" : k === "RECETTE" ? "Recettes" : k === "DEPENSE" ? "Dépenses" : STATUS_FR[k]}</Button>
        ))}
      </div>
      {entries.isError ? <p className="text-sm text-destructive">Opérations indisponibles (chargement ou droits).</p> : entries.isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement…</p> : list.length === 0 ? (
        <EmptyState title="Aucune opération" message="Ajoutez une opération ou importez des adhésions HelloAsso." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>{["Date", "Type", "Catégorie", "Montant", "Personne / contexte", "Statut", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((e, i) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2">{e.entry_date}</td>
                  <td className="px-3 py-2">{e.direction === "RECETTE" ? "Recette" : "Dépense"}</td>
                  <td className="px-3 py-2">{categoryLabel(e.category)}</td>
                  <td className="px-3 py-2 font-semibold">{Number(e.amount).toFixed(2)} €</td>
                  <td className="px-3 py-2">{rows[i]?.personne || rows[i]?.projet || rows[i]?.activite || e.description || "—"}</td>
                  <td className="px-3 py-2">
                    <select aria-label="Statut" disabled={!rights.update} className="h-9 rounded-md border border-input bg-background px-2" value={e.status} onChange={(ev) => setStatus.mutate({ id: e.id, status: ev.target.value })}>
                      {Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </td>
                  <td className="px-3 py-2">{e.receipt_url ? <a className="underline" href={e.receipt_url} target="_blank" rel="noreferrer">Justificatif</a> : <span className="text-xs text-muted-foreground">sans justificatif</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Colonnes exportées : {EXPORT_COLUMNS.join(", ")}. Le bilan de l'exercice pour l'AG se prépare dans <Link to="/statistics" className="underline">Statistiques</Link>.</p>

      <AccountingSplitsPanel />

      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-semibold">Recettes HelloAsso — adhésions et journal</h2>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm">
            <Upload className="size-3.5" />Importer un export CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importHelloAsso(file); e.target.value = ""; }} />
          </label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Réimporter le même fichier ne crée aucun doublon. Plusieurs fiches possibles ⇒ « à valider », jamais de fusion automatique.</p>
        <ul className="mt-3 space-y-2">
          {(journal.data ?? []).map((j) => (
            <li key={j.id} className="rounded-lg bg-muted p-2 text-sm">
              <span className="font-semibold">{OUT_FR[j.outcome] ?? j.outcome}</span> · {j.source} {j.external_id ? `#${j.external_id}` : ""} · {new Date(j.created_at).toLocaleString("fr-FR")}
              {j.message && <span className="block text-xs">{j.message}</span>}
              {Array.isArray(j.candidates) && <span className="block text-xs">Fiches possibles : {(j.candidates as { name: string }[]).map((c) => c.name).join(", ")}</span>}
              {(j.outcome === "TO_REVIEW" || j.outcome === "PERSON_ONLY" || j.outcome === "ERROR") && !j.resolved_at && (
                <Button size="sm" variant="outline" className="mt-1" onClick={() => resolve.mutate(j.id)}>Marquer comme traité</Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
