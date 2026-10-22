import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { REIMBURSEMENT_LABEL, allowedReimbursementActions, balancesByMember, euro, payoutLabel, summarizePayouts, summarizeReimbursements } from "@/lib/finance-status";
import { useSensitiveRights } from "@/lib/permissions";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Euro, Plus, Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finances — La Voix du Chien" },
      {
        name: "description",
        content:
          "Suivi financier de l'association : recettes par événement, répartition association / professionnels et demandes de remboursement.",
      },
      { property: "og:title", content: "Finances — La Voix du Chien" },
      {
        property: "og:description",
        content: "Recettes, répartitions et remboursements de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { user } = useAuth();
  const rights = useSensitiveRights();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Comptabilité : droit explicite requis (Bureau ET permission). Les autres retrouvent leur espace personnel.
  const canReimb = rights.viewGlobal || rights.validateReimbursements || rights.markPaid;
  const allowed = rights.viewGlobal || canReimb;
  useEffect(() => {
    if (rights.ready && !allowed) {
      toast.info("Vos demandes et paiements sont dans « Paiements & remboursements ».");
      void navigate({ to: "/reimbursements", replace: true });
    }
  }, [rights.ready, allowed, navigate]);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState({ label: "", gross_revenue: "0", association_share: "0", professional_share: "0" });

  const { data: rows = [], isError: rowsError } = useQuery({
    queryKey: ["accounting"],
    enabled: rights.viewGlobal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting")
        .select("*")
        .order("recorded_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: reimbursements = [], isError: reimbError } = useQuery({
    queryKey: ["reimbursements", "all"],
    enabled: canReimb,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const personIds = [...new Set([...reimbursements.map((r) => r.person_id), ...rows.map((r) => r.professional_id).filter(Boolean) as string[]])];
  const { data: names = {} } = useQuery({
    queryKey: ["finance-names", personIds.join(",")],
    enabled: allowed && personIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", personIds);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const p of (data ?? []) as unknown as { id: string; first_name?: string | null; last_name?: string | null }[]) out[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Membre";
      return out;
    },
  });
  const nameOf = (id: string | null) => (id ? names[id] ?? "Membre" : "—");
  const balances = balancesByMember(reimbursements);
  const proRows = rows.filter((r) => r.professional_id && Number(r.professional_share) > 0);
  const payoutSum = summarizePayouts(proRows);

  const setPayout = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("accounting").update({ professional_paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw new Error("Mise à jour refusée. Actualisez la page.");
    },
    onSuccess: () => { toast.success("Reversement mis à jour."); void queryClient.invalidateQueries({ queryKey: ["accounting"] }); },
    onError: (e: Error) => toast.error(e.message),
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
      toast.success("Ligne comptable ajoutée.");
      setOpen(false);
      setLine({ label: "", gross_revenue: "0", association_share: "0", professional_share: "0" });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reimbursements")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(financeErrorMessage(error.message));
    },
    onSuccess: () => {
      toast.success("Demande mise à jour.");
      void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => { toast.error(error.message); void queryClient.invalidateQueries({ queryKey: ["reimbursements"] }); },
  });

  const totals = rows.reduce(
    (acc, row) => ({
      gross: acc.gross + Number(row.gross_revenue),
      association: acc.association + Number(row.association_share),
      professional: acc.professional + Number(row.professional_share),
    }),
    { gross: 0, association: 0, professional: 0 },
  );

  const rsum = summarizeReimbursements(reimbursements);
  if (!rights.ready || !allowed) return <AppShell title="Finances"><p className="text-sm text-muted-foreground">{rights.ready ? "Redirection vers votre espace personnel…" : "Vérification de vos droits…"}</p></AppShell>;

  return (
    <AppShell
      title="Finances"
      subtitle="Comptabilité du Bureau : recettes, répartitions, reversements et remboursements"
      actions={
        rights.update ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Nouvelle ligne
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle ligne comptable</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fi-label">Libellé</Label>
                  <Input id="fi-label" value={line.label} onChange={(e) => setLine({ ...line, label: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="fi-gross">Brut (€)</Label>
                    <Input
                      id="fi-gross"
                      type="number"
                      step="0.01"
                      value={line.gross_revenue}
                      onChange={(e) => setLine({ ...line, gross_revenue: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fi-asso">Asso (€)</Label>
                    <Input
                      id="fi-asso"
                      type="number"
                      step="0.01"
                      value={line.association_share}
                      onChange={(e) => setLine({ ...line, association_share: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fi-pro">Pro (€)</Label>
                    <Input
                      id="fi-pro"
                      type="number"
                      step="0.01"
                      value={line.professional_share}
                      onChange={(e) => setLine({ ...line, professional_share: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addLine.mutate()} disabled={addLine.isPending}>
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <BureauConsoleTabs />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Recettes brutes", value: totals.gross },
          { label: "Part association", value: totals.association },
          { label: "Part professionnels", value: totals.professional },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 text-2xl font-semibold">
                <Euro className="size-5 text-primary" />
                {rowsError ? "—" : stat.value.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lignes comptables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rowsError ? (
            <p className="text-destructive">Lignes comptables indisponibles (chargement ou droits).</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">Aucune ligne enregistrée.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.label ?? "Recette"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.recorded_on).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  {Number(row.gross_revenue).toFixed(2)} €
                  <span className="block text-xs text-muted-foreground">
                    asso {Number(row.association_share).toFixed(2)} € · pro{" "}
                    {Number(row.professional_share).toFixed(2)} €
                  </span>
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reversements aux professionnels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            {[["À payer", payoutSum.due], ["Payé", payoutSum.paid]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="font-semibold">{rowsError ? "—" : euro(v as number)}</p>
              </div>
            ))}
          </div>
          {proRows.length === 0 ? <p className="text-muted-foreground">Aucune part professionnelle enregistrée.</p> : proRows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nameOf(r.professional_id)}</p>
                <p className="text-xs text-muted-foreground">{r.label ?? "Recette"} · {new Date(r.recorded_on).toLocaleDateString("fr-FR")}</p>
              </div>
              <span className="font-semibold">{euro(Number(r.professional_share))}</span>
              <Badge variant={r.professional_paid_at ? "default" : "outline"}>{payoutLabel(r.professional_paid_at)}</Badge>
              <Button size="sm" variant={r.professional_paid_at ? "ghost" : "outline"} disabled={setPayout.isPending} onClick={() => setPayout.mutate({ id: r.id, paid: !r.professional_paid_at })}>
                {r.professional_paid_at ? "Annuler" : "Marquer payé"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Solde par membre</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {reimbError ? <p className="text-destructive">Soldes indisponibles.</p> : balances.length === 0 ? <p className="text-muted-foreground">Aucun solde en cours.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-normal">Membre</th><th className="py-1 pr-3 font-normal">En attente</th><th className="py-1 pr-3 font-normal">Reste à payer</th><th className="py-1 font-normal">Payé</th></tr></thead>
                <tbody>{balances.map((b) => (
                  <tr key={b.personId} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{nameOf(b.personId)}</td>
                    <td className="py-2 pr-3">{euro(b.pending)}</td>
                    <td className="py-2 pr-3 font-semibold">{euro(b.toPay)}</td>
                    <td className="py-2">{euro(b.paid)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" /> Remboursements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            {[["En attente", rsum.pending], ["Approuvé, à payer", rsum.approved], ["Payé", rsum.paid]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="font-semibold">{reimbError ? "—" : euro(v as number)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Les nouvelles demandes se font depuis « Paiements & remboursements ».</p>
          {reimbError ? (
            <p className="text-destructive">Remboursements indisponibles (chargement ou droits).</p>
          ) : reimbursements.length === 0 ? (
            <p className="text-muted-foreground">Aucune demande enregistrée.</p>
          ) : (
            reimbursements.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label} <span className="font-normal text-muted-foreground">· {nameOf(item.person_id)}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {Number(item.amount).toFixed(2)} € ·{" "}
                    {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={item.status === "PAID" ? "default" : "outline"}>{REIMBURSEMENT_LABEL[item.status] ?? item.status}</Badge>
                  {canProcessReimbursement(user?.id, item.person_id, isBureau)
                    ? nextReimbursementActions(item.status).map((next) => (
                        <Button key={next} size="sm" variant={next === "REJECTED" ? "ghost" : "outline"} disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: item.id, status: next })}>
                          {next === "APPROVED" ? "Approuver" : next === "PAID" ? "Marquer payé" : "Refuser"}
                        </Button>
                      ))
                    : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
