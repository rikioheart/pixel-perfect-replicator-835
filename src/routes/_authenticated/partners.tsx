import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Globe, Handshake, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "Partenaires et codes promo — La Voix du Chien" },
      {
        name: "description",
        content:
          "Partenaires de l'association, avantages négociés et codes promotionnels réservés aux adhérents.",
      },
      { property: "og:title", content: "Partenaires et codes promo — La Voix du Chien" },
      {
        property: "og:description",
        content: "Avantages et codes promo réservés aux adhérents de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

type PromoCode = { code: string; label?: string };

function PartnersPage() {
  const { isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "ENTREPRISE",
    contact: "",
    website_url: "",
    advantages: "",
    promo_code: "",
  });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.name.trim().length < 2) throw new Error("Le nom du partenaire est obligatoire.");
      const { error } = await supabase.from("partners").insert({
        name: form.name.trim(),
        type: form.type,
        contact: form.contact || null,
        website_url: form.website_url || null,
        advantages: form.advantages || null,
        promo_codes: (form.promo_code
          ? [{ code: form.promo_code, label: form.advantages || "Avantage adhérent" }]
          : []) as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Partenaire ajouté.");
      setOpen(false);
      setForm({ name: "", type: "ENTREPRISE", contact: "", website_url: "", advantages: "", promo_code: "" });
      void queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Partenaires"
      subtitle="Avantages et codes promo réservés aux adhérents"
      actions={
        isBureau ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Nouveau partenaire
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau partenaire</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pa-name">Nom</Label>
                  <Input
                    id="pa-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="pa-type">Type</Label>
                    <select
                      id="pa-type"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="ENTREPRISE">Entreprise</option>
                      <option value="ASSOCIATION">Association</option>
                      <option value="COLLECTIVITE">Collectivité</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="pa-contact">Contact</Label>
                    <Input
                      id="pa-contact"
                      value={form.contact}
                      onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="pa-web">Site web</Label>
                  <Input
                    id="pa-web"
                    value={form.website_url}
                    onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="pa-adv">Avantages</Label>
                  <Textarea
                    id="pa-adv"
                    value={form.advantages}
                    onChange={(e) => setForm({ ...form, advantages: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="pa-code">Code promo (optionnel)</Label>
                  <Input
                    id="pa-code"
                    value={form.promo_code}
                    onChange={(e) => setForm({ ...form, promo_code: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending ? "Ajout…" : "Ajouter"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des partenaires…</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun partenaire enregistré.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {partners.map((partner) => {
            const codes = (partner.promo_codes ?? []) as unknown as PromoCode[];
            return (
              <Card key={partner.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Handshake className="size-4 text-primary" /> {partner.name}
                    </CardTitle>
                    <Badge variant="secondary">{partner.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {partner.advantages ? (
                    <p className="text-muted-foreground">{partner.advantages}</p>
                  ) : null}
                  {partner.website_url ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="size-4" />
                      <a href={partner.website_url} target="_blank" rel="noreferrer" className="truncate underline">
                        {partner.website_url}
                      </a>
                    </p>
                  ) : null}
                  {codes.map((promo) => (
                    <button
                      key={promo.code}
                      className="flex w-full items-center justify-between rounded-md border border-dashed border-primary px-3 py-2 text-sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(promo.code);
                        toast.success("Code promo copié.");
                      }}
                    >
                      <span className="font-mono">{promo.code}</span>
                      <Copy className="size-3.5" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
