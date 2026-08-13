import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Euro, Plus, Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState({ label: "", gross_revenue: "0", association_share: "0", professional_share: "0" });
  const [claim, setClaim] = useState({ label: "", amount: "0" });

  const { data: rows = [] } = useQuery({
    queryKey: ["accounting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting")
        .select("*")
        .order("recorded_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: reimbursements = [] } = useQuery({
    queryKey: ["reimbursements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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

  const askReimbursement = useMutation({
    mutationFn: async () => {
      if (!claim.label.trim()) throw new Error("Précisez l'objet de la demande.");
      if (Number(claim.amount) <= 0) throw new Error("Le montant doit être supérieur à zéro.");
      const { error } = await supabase.from("reimbursements").insert({
        person_id: user!.id,
        label: claim.label.trim(),
        amount: Number(claim.amount),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de remboursement envoyée.");
      setClaim({ label: "", amount: "0" });
      void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reimbursements")
        .update({ status, processed_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour.");
      void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = rows.reduce(
    (acc, row) => ({
      gross: acc.gross + Number(row.gross_revenue),
      association: acc.association + Number(row.association_share),
      professional: acc.professional + Number(row.professional_share),
    }),
    { gross: 0, association: 0, professional: 0 },
  );

  return (
    <AppShell
      title="Finances"
      subtitle={isBureau ? "Recettes, répartitions et remboursements" : "Mes données financières"}
      actions={
        isBureau ? (
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
                {stat.value.toFixed(2)}
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
          {rows.length === 0 ? (
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" /> Remboursements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <div>
              <Label htmlFor="rb-label">Objet de la demande</Label>
              <Input id="rb-label" value={claim.label} onChange={(e) => setClaim({ ...claim, label: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="rb-amount">Montant (€)</Label>
              <Input
                id="rb-amount"
                type="number"
                step="0.01"
                value={claim.amount}
                onChange={(e) => setClaim({ ...claim, amount: e.target.value })}
              />
            </div>
            <Button onClick={() => askReimbursement.mutate()} disabled={askReimbursement.isPending}>
              Demander
            </Button>
          </div>

          {reimbursements.length === 0 ? (
            <p className="text-muted-foreground">Aucune demande enregistrée.</p>
          ) : (
            reimbursements.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(item.amount).toFixed(2)} € ·{" "}
                    {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={item.status === "PAID" ? "default" : "outline"}>{item.status}</Badge>
                  {isBureau && item.status === "PENDING" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: item.id, status: "PAID" })}>
                        Rembourser
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus.mutate({ id: item.id, status: "REJECTED" })}
                      >
                        Refuser
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
