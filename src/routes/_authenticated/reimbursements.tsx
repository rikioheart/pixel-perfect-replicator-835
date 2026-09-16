import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Euro, Plus, Receipt, Check, X } from "lucide-react";
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

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validé",
  PAID: "Remboursé",
  REFUSED: "Refusé",
};

const EMPTY = { label: "", amount: "", receipt_url: "" };

function ReimbursementsPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["reimbursements", isBureau],
    queryFn: async () => {
      let query = supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });
      if (!isBureau) query = query.eq("person_id", user!.id);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.label.trim()) throw new Error("Décrivez la dépense.");
      const amount = Number(form.amount.replace(",", "."));
      if (!amount || amount <= 0) throw new Error("Indiquez un montant valide.");
      const { error } = await supabase.from("reimbursements").insert({
        person_id: user!.id,
        label: form.label.trim(),
        amount,
        receipt_url: form.receipt_url.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Demande envoyée au Bureau.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reimbursements")
        .update({ status, processed_by: user!.id })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Demande mise à jour.");
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = data ?? [];
  const total = rows
    .filter((r) => r.status !== "REFUSED")
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return (
    <AppShell
      title="Paiements & remboursements"
      subtitle={
        isBureau
          ? "Traitez les notes de frais des bénévoles et suivez les montants engagés."
          : "Demandez le remboursement des frais que vous avancez pour l'association."
      }
      actions={
        <Button className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" /> Nouvelle demande
        </Button>
      }
    >
      <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <Euro className="size-4 text-primary" />
        <span className="font-semibold">
          {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
        </span>
        <span className="text-muted-foreground">de frais suivis</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des demandes…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune demande"
          message="Vos demandes de remboursement apparaîtront ici une fois créées."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-[200px] flex-1">
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString("fr-FR")} ·{" "}
                  {STATUS_LABEL[item.status] ?? item.status}
                </p>
              </div>
              <span className="font-display text-base font-bold">
                {Number(item.amount).toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
              {item.receipt_url ? (
                <a
                  href={item.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                >
                  <Receipt className="size-3.5" /> Justificatif
                </a>
              ) : null}
              {isBureau && item.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: item.id, status: "PAID" })}
                  >
                    <Check className="mr-1 size-3.5" /> Rembourser
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: item.id, status: "REFUSED" })}
                  >
                    <X className="mr-1 size-3.5" /> Refuser
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

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
