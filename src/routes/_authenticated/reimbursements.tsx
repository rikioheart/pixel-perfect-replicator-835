import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Euro, Plus, Receipt } from "lucide-react";
import { REIMBURSEMENT_LABEL, summarizeReimbursements, euro } from "@/lib/finance-status";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/reimbursements")({
  head: () => ({
    meta: [
      { title: "Paiements & remboursements — La Voix du Chien" },
      {
        name: "description",
        content:
          "Demandez le remboursement de vos frais engagés pour l'association et suivez le traitement par le Bureau.",
      },
      {
        property: "og:title",
        content: "Paiements & remboursements — La Voix du Chien",
      },
      {
        property: "og:description",
        content: "Notes de frais, justificatifs et suivi des remboursements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReimbursementsPage,
});

const EMPTY = { label: "", amount: "", receipt_url: "" };

function ReimbursementsPage() {
  const { user, isPro } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  // Espace personnel : uniquement mes propres demandes, même pour un membre du Bureau.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reimbursements", "mine", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*")
        .eq("person_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Reversements professionnels : lignes qui me concernent (lecture autorisée par la base).
  const payouts = useQuery({
    queryKey: ["my-payouts", user?.id],
    enabled: !!user && isPro,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting")
        .select("id, label, professional_share, recorded_on")
        .eq("professional_id", user!.id)
        .order("recorded_on", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.label.trim()) throw new Error("Décrivez la dépense.");
      const amount = Number(form.amount.replace(",", "."));
      if (!amount || amount <= 0) throw new Error("Indiquez un montant valide.");
      const receipt = form.receipt_url.trim();
      if (receipt && !/^https?:\/\//i.test(receipt)) throw new Error("Le justificatif doit être un lien https://");
      const { error } = await supabase.from("reimbursements").insert({
        person_id: user!.id,
        label: form.label.trim(),
        amount,
        receipt_url: receipt || null,
      });
      if (error) throw new Error("La demande n'a pas pu être envoyée. Réessayez.");
    },
    onSuccess: () => {
      toast.success("Demande envoyée au Bureau.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = data ?? [];
  const sum = summarizeReimbursements(rows);

  return (
    <AppShell
      title="Paiements & remboursements"
      subtitle="Vos demandes de remboursement et, pour les professionnels, vos reversements. Vous seul les voyez, avec le Bureau."
      actions={
        <Button className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" /> Nouvelle demande
        </Button>
      }
    >
      {isError ? (
        <p className="panel p-4 text-sm text-destructive">Impossible de charger vos demandes pour le moment. Réessayez plus tard.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des demandes…</p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "En attente", value: sum.pending },
              { label: "Approuvé, à recevoir", value: sum.approved },
              { label: "Déjà remboursé", value: sum.paid },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="flex items-center gap-1.5 font-display text-lg font-bold"><Euro className="size-4 text-primary" />{euro(s.value)}</p>
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Aucune demande" message="Vos demandes de remboursement apparaîtront ici une fois créées." />
          ) : (
            <div className="space-y-3">
              {rows.map((item) => (
                <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("fr-FR")} · {REIMBURSEMENT_LABEL[item.status] ?? item.status}
                    </p>
                  </div>
                  <span className="font-display text-base font-bold">{euro(Number(item.amount))}</span>
                  {item.receipt_url ? (
                    <a href={item.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Receipt className="size-3.5" /> Justificatif
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {isPro ? (
        <section className="mt-8 space-y-3" aria-labelledby="payouts-title">
          <h2 id="payouts-title" className="font-display text-lg">Mes reversements</h2>
          {payouts.isError ? (
            <p className="text-sm text-destructive">Reversements indisponibles pour le moment.</p>
          ) : (payouts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun reversement enregistré par le Bureau pour l'instant.</p>
          ) : (
            (payouts.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span>{p.label ?? "Prestation"} · {new Date(p.recorded_on).toLocaleDateString("fr-FR")}</span>
                <span className="font-semibold">{euro(Number(p.professional_share))}</span>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">Montants calculés par le Bureau à partir des recettes enregistrées ; aucune estimation automatique.</p>
        </section>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle demande de remboursement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="r-label">Dépense</Label>
              <Input
                id="r-label"
                placeholder="Achat de croquettes pour l'atelier"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-amount">Montant (€)</Label>
              <Input
                id="r-amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-receipt">Lien du justificatif</Label>
              <Input
                id="r-receipt"
                placeholder="https://…"
                value={form.receipt_url}
                onChange={(e) => setForm({ ...form, receipt_url: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="rounded-full"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
