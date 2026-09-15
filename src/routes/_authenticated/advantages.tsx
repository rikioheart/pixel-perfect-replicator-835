import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/advantages")({
  head: () => ({
    meta: [
      { title: "Avantages adhérents — La Voix du Chien" },
      {
        name: "description",
        content:
          "Codes promo partenaires, activités offertes, goodies et séances proposées par les professionnels.",
      },
      { property: "og:title", content: "Avantages adhérents — La Voix du Chien" },
      {
        property: "og:description",
        content: "Les petits plus réservés aux adhérents de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvantagesPage,
});

const KINDS: [string, string][] = [
  ["CODE_PROMO", "Code promo"],
  ["ACTIVITE_OFFERTE", "Activité offerte"],
  ["GOODIE", "Goodie"],
  ["SEANCE_PRO", "Séance pro"],
  ["TARIF_REDUIT", "Tarif réduit"],
];

const KIND_LABEL = Object.fromEntries(KINDS);

const EMPTY = {
  title: "",
  description: "",
  kind: "CODE_PROMO",
  promo_code: "",
  partner_name: "",
  conditions: "",
  valid_until: "",
  quantity: "",
};

function AdvantagesPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["advantages", user?.id],
    queryFn: async () => {
      const [advantages, claims] = await Promise.all([
        supabase.from("advantages").select("*").order("created_at", { ascending: false }),
        supabase.from("advantage_claims").select("advantage_id, user_id"),
      ]);
      return { advantages: advantages.data ?? [], claims: claims.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Donnez un titre à cet avantage.");
      const { error } = await supabase.from("advantages").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        promo_code: form.promo_code.trim() || null,
        partner_name: form.partner_name.trim() || null,
        conditions: form.conditions.trim() || null,
        valid_until: form.valid_until || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Avantage publié.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["advantages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const claim = useMutation({
    mutationFn: async (advantageId: string) => {
      const { error } = await supabase
        .from("advantage_claims")
        .insert({ advantage_id: advantageId, user_id: user!.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("C'est réservé ! Le Bureau est prévenu.");
      queryClient.invalidateQueries({ queryKey: ["advantages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const advantages = data?.advantages ?? [];
  const claims = data?.claims ?? [];

  return (
    <AppShell
      title="Avantages adhérents"
      subtitle="Codes promo, activités offertes et séances proposées par nos partenaires et professionnels."
      actions={
        isBureau ? (
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Nouvel avantage
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des avantages…</p>
      ) : advantages.length === 0 ? (
        <EmptyState
          title="Aucun avantage pour l'instant"
          message="Les avantages négociés avec nos partenaires apparaîtront ici."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {advantages.map((item) => {
            const taken = claims.filter((c) => c.advantage_id === item.id);
            const mine = taken.some((c) => c.user_id === user?.id);
            const soldOut = item.quantity != null && taken.length >= item.quantity;
            return (
              <article key={item.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
                  <Gift className="size-3.5" /> {KIND_LABEL[item.kind] ?? item.kind}
                </span>
                <h2 className="mt-3 font-display text-base font-bold">{item.title}</h2>
                {item.partner_name ? (
                  <p className="text-xs text-muted-foreground">Avec {item.partner_name}</p>
                ) : null}
                {item.description ? (
                  <p className="mt-2 text-sm whitespace-pre-wrap">{item.description}</p>
                ) : null}
                {item.conditions ? (
                  <p className="mt-2 rounded-lg bg-muted/60 p-3 text-xs">{item.conditions}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.valid_until
                    ? `Valable jusqu'au ${new Date(item.valid_until).toLocaleDateString("fr-FR")}`
                    : "Sans date limite"}
                  {item.quantity != null ? ` · ${Math.max(item.quantity - taken.length, 0)} restant(s)` : ""}
                </p>
                <div className="mt-4 flex-1" />
                {mine ? (
                  <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm font-semibold">
                    Réservé{item.promo_code ? ` · code ${item.promo_code}` : ""}
                  </p>
                ) : (
                  <Button
                    className="rounded-full"
                    disabled={soldOut || claim.isPending}
                    onClick={() => claim.mutate(item.id)}
                  >
                    {soldOut ? "Complet" : "En profiter"}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel avantage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="partner">Partenaire</Label>
              <Input
                id="partner"
                value={form.partner_name}
                onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Code promo (facultatif)</Label>
              <Input
                id="code"
                value={form.promo_code}
                onChange={(e) => setForm({ ...form, promo_code: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="conditions">Conditions</Label>
              <Textarea
                id="conditions"
                rows={2}
                value={form.conditions}
                onChange={(e) => setForm({ ...form, conditions: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="until">Valable jusqu'au</Label>
                <Input
                  id="until"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quantity">Quantité</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="rounded-full"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
