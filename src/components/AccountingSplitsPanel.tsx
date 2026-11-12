import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSensitiveRights } from "@/lib/permissions";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { euro, financeErrorMessage, payoutLabel, summarizePayouts } from "@/lib/finance-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { humanizeError } from "@/lib/user-messages";

/**
 * Répartition des recettes (association / professionnels) et reversements aux pros : circuit « accounting »,
 * affiché dans Comptabilité & Grand livre mais jamais additionné aux opérations du grand livre.
 */
export function AccountingSplitsPanel() {
  const { user } = useAuth();
  const rights = useSensitiveRights();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState({ label: "", gross_revenue: "0", association_share: "0", professional_share: "0" });

  const { data: rows = [], isError } = useQuery({
    queryKey: ["accounting"],
    enabled: rights.viewGlobal,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting").select("*").order("recorded_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const proIds = [...new Set(rows.map((r) => r.professional_id).filter(Boolean) as string[])];
  const { data: names = {} } = useQuery({
    queryKey: ["accounting-names", proIds.join(",")],
    enabled: proIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", proIds);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const p of (data ?? []) as unknown as { id: string; first_name?: string | null; last_name?: string | null }[]) out[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Professionnel";
      return out;
    },
  });

  const setPayout = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("accounting").update({ professional_paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw new Error(financeErrorMessage(error.message));
    },
    onSuccess: () => { toast.success("Reversement mis à jour."); void qc.invalidateQueries({ queryKey: ["accounting"] }); },
    onError: (e: Error) => toast.error(humanizeError(e)),
  });
  const addLine = useMutation({
    mutationFn: async () => {
      if (!line.label.trim()) throw new Error("Le libellé est obligatoire.");
      const { error } = await supabase.from("accounting").insert({
        label: line.label.trim(),
        gross_revenue: Number(line.gross_revenue) || 0,
        association_share: Number(line.association_share) || 0,
        professional_share: Number(line.professional_share) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Répartition ajoutée.");
      setOpen(false);
      setLine({ label: "", gross_revenue: "0", association_share: "0", professional_share: "0" });
      void qc.invalidateQueries({ queryKey: ["accounting"] });
    },
    onError: (e: Error) => toast.error(humanizeError(e)),
  });

  const totals = rows.reduce((t, r) => ({ gross: t.gross + Number(r.gross_revenue), asso: t.asso + Number(r.association_share), pro: t.pro + Number(r.professional_share) }), { gross: 0, asso: 0, pro: 0 });
  const proRows = rows.filter((r) => r.professional_id && Number(r.professional_share) > 0);
  const payouts = summarizePayouts(proRows);
  const money = (n: number) => (isError ? "—" : euro(n));

  return (
    <section aria-labelledby="splits-title" className="mt-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="splits-title" className="flex-1 font-semibold">Répartition des recettes et reversements aux professionnels</h2>
        {rights.update ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1"><Plus className="size-4" aria-hidden /> Nouvelle répartition</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle répartition de recette</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label htmlFor="sp-label">Libellé</Label><Input id="sp-label" value={line.label} onChange={(e) => setLine({ ...line, label: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label htmlFor="sp-gross">Brut (€)</Label><Input id="sp-gross" type="number" step="0.01" value={line.gross_revenue} onChange={(e) => setLine({ ...line, gross_revenue: e.target.value })} /></div>
                  <div><Label htmlFor="sp-asso">Asso (€)</Label><Input id="sp-asso" type="number" step="0.01" value={line.association_share} onChange={(e) => setLine({ ...line, association_share: e.target.value })} /></div>
                  <div><Label htmlFor="sp-pro">Pro (€)</Label><Input id="sp-pro" type="number" step="0.01" value={line.professional_share} onChange={(e) => setLine({ ...line, professional_share: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={() => addLine.mutate()} disabled={addLine.isPending}>Enregistrer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Recettes partagées avec un professionnel : suivies à part, jamais ajoutées au grand livre ci-dessus.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {([["Recettes brutes", totals.gross], ["Part association", totals.asso], ["Part professionnels", totals.pro], ["Reversements à payer", payouts.due], ["Reversements payés", payouts.paid]] as const).map(([l, v]) => (
          <div key={l} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="font-semibold">{money(v)}</p>
          </div>
        ))}
      </div>

      {isError ? <p className="mt-3 text-sm text-destructive">Répartitions indisponibles (chargement ou droits).</p> : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aucune répartition enregistrée.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((r) => {
            const hasPro = Boolean(r.professional_id) && Number(r.professional_share) > 0;
            return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.label ?? "Recette"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.recorded_on).toLocaleDateString("fr-FR")} · brut {euro(Number(r.gross_revenue))} · asso {euro(Number(r.association_share))}
                  {hasPro ? ` · ${(r.professional_id && names[r.professional_id]) || "Professionnel"} ${euro(Number(r.professional_share))}` : ""}
                </p>
              </div>
              {hasPro ? <Badge variant={r.professional_paid_at ? "default" : "outline"}>{payoutLabel(r.professional_paid_at)}</Badge> : null}
              {hasPro && rights.update && r.professional_id !== user?.id ? (
                <Button size="sm" variant={r.professional_paid_at ? "ghost" : "outline"} disabled={setPayout.isPending} onClick={() => setPayout.mutate({ id: r.id, paid: !r.professional_paid_at })}>
                  {r.professional_paid_at ? "Annuler" : "Marquer payé"}
                </Button>
              ) : null}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
