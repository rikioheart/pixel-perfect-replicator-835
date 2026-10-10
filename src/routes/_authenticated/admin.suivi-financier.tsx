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
import { useAuth } from "@/hooks/useAuth";
import { buildRows, toCsv, toTsv, parseHelloAssoCsv, EXPORT_COLUMNS } from "@/lib/finance-export";

export const Route = createFileRoute("/_authenticated/admin/suivi-financier")({
  head: () => ({
    meta: [
      { title: "Suivi financier — La Voix du Chien" },
      { name: "description", content: "Suivi opérationnel des recettes, dépenses, locations et adhésions, avec export pour la comptabilité." },
      { property: "og:title", content: "Suivi financier — La Voix du Chien" },
      { property: "og:description", content: "Préparer les données pour la comptabilité, sans la remplacer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const CATS = { RECETTE: ["ADHESION", "CONTRIBUTION", "LOCATION_TERRAIN", "ACTIVITE", "FORMATION", "AUTRE_RECETTE"],
  DEPENSE: ["ACHAT", "MATERIEL", "REMBOURSEMENT", "FRAIS_ACTIVITE", "FRAIS_PROJET", "AUTRE_DEPENSE"] } as const;
const STATUS_FR: Record<string, string> = { A_RECEVOIR: "À recevoir", RECU: "Reçu", A_PAYER: "À payer", PAYE: "Payé", TRANSMIS: "Transmis compta", ANNULE: "Annulé" };
const OUT_FR: Record<string, string> = { CREATED: "Créé", UPDATED: "Mis à jour", UNCHANGED: "Déjà connu", TO_REVIEW: "À valider", PERSON_ONLY: "Personne sans compte", ERROR: "Erreur", RESOLVED: "Traité", EXPORTED: "Exporté" };
const EMPTY = { entry_date: new Date().toISOString().slice(0, 10), direction: "RECETTE", category: "CONTRIBUTION", amount: "", description: "", status: "A_RECEVOIR", receipt_url: "", payment_method: "", external_ref: "", internal_note: "" };

function Page() {
  const { isBureau } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const [filter, setFilter] = useState("");

  const entries = useQuery({
    queryKey: ["finance-entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_entries")
        .select("*, people(display_name, first_name, last_name), projects(title), activities(title)")
        .order("entry_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const rentals = useQuery({
    queryKey: ["rentals-untracked"],
    queryFn: async () => {
      const { data } = await supabase.from("terrain_reservations").select("id, date, purpose, status, rental_terms")
        .eq("access_mode", "LOCATION").in("status", ["APPROVED", "PENDING"]).order("date", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const journal = useQuery({
    queryKey: ["integration-events"],
    queryFn: async () => {
      const { data } = await supabase.from("integration_events").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["finance-entries"] }); void qc.invalidateQueries({ queryKey: ["integration-events"] }); void qc.invalidateQueries({ queryKey: ["rentals-untracked"] }); };

  const add = useMutation({
    mutationFn: async (extra: Partial<Record<string, unknown>> = {}) => {
      const amount = Number(String(extra["amount"] ?? f.amount).replace(",", "."));
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Montant invalide.");
      const { error } = await supabase.from("finance_entries").insert({
        entry_date: f.entry_date, direction: f.direction, category: f.category, amount,
        description: f.description || null, status: f.status, receipt_url: f.receipt_url || null,
        payment_method: f.payment_method || null, external_ref: f.external_ref || null, internal_note: f.internal_note || null,
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
  const tracked = new Set((entries.data ?? []).map((e) => e.reservation_id).filter(Boolean));
  const totals = list.filter((e) => e.status !== "ANNULE").reduce((t, e) => {
    t[e.direction === "RECETTE" ? "in" : "out"] += Number(e.amount); return t; }, { in: 0, out: 0 });

  const download = () => {
    const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `suivi-financier-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (!isBureau) return <AppShell title="Suivi financier"><EmptyState title="Réservé au Bureau" message="Le suivi financier est accessible au Bureau disposant du droit finances." /></AppShell>;

  return (
    <AppShell title="Suivi financier" subtitle="Suivi opérationnel et préparation des exports. La comptabilité officielle reste tenue dans l'outil comptable de l'association.">
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Recettes suivies</p><p className="text-xl font-bold">{totals.in.toFixed(2)} €</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Dépenses suivies</p><p className="text-xl font-bold">{totals.out.toFixed(2)} €</p></div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
          <Button size="sm" onClick={download}><Download className="mr-1 size-3.5" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(toTsv(rows)); toast.success("Copié : collez directement dans Google Sheets ou un tableur."); }}><Copy className="mr-1 size-3.5" />Copier pour tableur</Button>
        </div>
      </section>

      <details className="mb-6 rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">Ajouter une opération</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="fe-d">Date</Label><Input id="fe-d" type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} /></div>
          <div><Label htmlFor="fe-dir">Sens</Label>
            <select id="fe-dir" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.direction}
              onChange={(e) => setF({ ...f, direction: e.target.value, category: CATS[e.target.value as "RECETTE"][0], status: e.target.value === "RECETTE" ? "A_RECEVOIR" : "A_PAYER" })}>
              <option value="RECETTE">Recette</option><option value="DEPENSE">Dépense</option></select></div>
          <div><Label htmlFor="fe-cat">Catégorie</Label>
            <select id="fe-cat" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATS[f.direction as "RECETTE"].map((c) => <option key={c} value={c}>{c.replace(/_/g, " ").toLowerCase()}</option>)}</select></div>
          <div><Label htmlFor="fe-a">Montant (€)</Label><Input id="fe-a" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label htmlFor="fe-s">Statut</Label>
            <select id="fe-s" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><Label htmlFor="fe-pm">Mode de paiement</Label><Input id="fe-pm" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="fe-desc">Description</Label><Input id="fe-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label htmlFor="fe-ref">Référence</Label><Input id="fe-ref" value={f.external_ref} onChange={(e) => setF({ ...f, external_ref: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="fe-r">Lien du justificatif</Label><Input id="fe-r" placeholder="https://…" value={f.receipt_url} onChange={(e) => setF({ ...f, receipt_url: e.target.value })} /></div>
          <div><Label htmlFor="fe-n">Note interne</Label><Input id="fe-n" value={f.internal_note} onChange={(e) => setF({ ...f, internal_note: e.target.value })} /></div>
        </div>
        <Button className="mt-3" onClick={() => add.mutate({})} disabled={add.isPending}>Enregistrer</Button>
      </details>

      {(rentals.data ?? []).filter((r) => !tracked.has(r.id)).length > 0 && (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Locations de terrain sans suivi</h2>
          <p className="mb-2 text-xs text-muted-foreground">Une réservation ne devient jamais une opération automatiquement : à vous de décider.</p>
          {(rentals.data ?? []).filter((r) => !tracked.has(r.id)).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-border py-2 text-sm">
              <span className="flex-1">{r.date} · {r.purpose ?? "Location"} {r.rental_terms ? `· ${r.rental_terms}` : ""}</span>
              <Button size="sm" variant="outline" onClick={() => {
                const v = prompt("Montant dû pour cette location (€) ?"); if (v == null) return;
                add.mutate({ amount: v, reservation_id: r.id, direction: "RECETTE", category: "LOCATION_TERRAIN", status: "A_RECEVOIR", description: `Location terrain ${r.date}` });
              }}>Suivre le montant dû</Button>
            </div>
          ))}
        </section>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer">
        {["", "RECETTE", "DEPENSE", "A_RECEVOIR", "A_PAYER", "TRANSMIS"].map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k === "" ? "Tout" : k === "RECETTE" ? "Recettes" : k === "DEPENSE" ? "Dépenses" : STATUS_FR[k]}</Button>
        ))}
      </div>
      {entries.isLoading ? <p role="status" className="text-sm text-muted-foreground">Chargement…</p> : list.length === 0 ? (
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
                  <td className="px-3 py-2">{e.category.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-3 py-2 font-semibold">{Number(e.amount).toFixed(2)} €</td>
                  <td className="px-3 py-2">{rows[i]?.personne || rows[i]?.projet || rows[i]?.activite || e.description || "—"}</td>
                  <td className="px-3 py-2">
                    <select aria-label="Statut" className="h-9 rounded-md border border-input bg-background px-2" value={e.status} onChange={(ev) => setStatus.mutate({ id: e.id, status: ev.target.value })}>
                      {Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </td>
                  <td className="px-3 py-2">{e.receipt_url ? <a className="underline" href={e.receipt_url} target="_blank" rel="noreferrer">Justificatif</a> : <span className="text-xs text-muted-foreground">sans justificatif</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Colonnes exportées : {EXPORT_COLUMNS.join(", ")}.</p>

      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-semibold">HelloAsso — adhésions et journal</h2>
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
