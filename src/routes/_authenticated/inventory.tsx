import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Minus, Package, Plus } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventaire — La Voix du Chien" },
      {
        name: "description",
        content:
          "Suivi du matériel de l'association : quantités disponibles, seuils d'alerte et emplacements de stockage.",
      },
      { property: "og:title", content: "Inventaire — La Voix du Chien" },
      {
        property: "og:description",
        content: "Stocks, seuils d'alerte et emplacements du matériel associatif.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", quantity: "0", alert_threshold: "0", location: "" });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [alertOnly, setAlertOnly] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.name.trim().length < 2) throw new Error("Le nom de l'article est obligatoire.");
      const { error } = await supabase.from("inventory").insert({
        name: form.name.trim(),
        category: form.category || null,
        quantity: Number(form.quantity) || 0,
        alert_threshold: Number(form.alert_threshold) || 0,
        location: form.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Article ajouté.");
      setOpen(false);
      setForm({ name: "", category: "", quantity: "0", alert_threshold: "0", location: "" });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjust = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("inventory").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const lowStock = items.filter((item) => item.quantity <= item.alert_threshold);
  const categories = Array.from(
    new Set(items.map((item) => item.category).filter((c): c is string => Boolean(c))),
  ).sort();
  const filtered = items.filter((item) => {
    const matchesSearch =
      search.trim().length === 0 ||
      `${item.name} ${item.category ?? ""} ${item.location ?? ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    const matchesCategory = category === "ALL" || item.category === category;
    const matchesAlert = !alertOnly || item.quantity <= item.alert_threshold;
    return matchesSearch && matchesCategory && matchesAlert;
  });
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppShell
      title="Inventaire"
      subtitle="Matériel de l'association et seuils d'alerte"
      actions={
        isBureau ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Nouvel article
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvel article</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="inv-name">Nom</Label>
                  <Input id="inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="inv-cat">Catégorie</Label>
                    <Input
                      id="inv-cat"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inv-loc">Emplacement</Label>
                    <Input
                      id="inv-loc"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="inv-qty">Quantité</Label>
                    <Input
                      id="inv-qty"
                      type="number"
                      min="0"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inv-alert">Seuil d'alerte</Label>
                    <Input
                      id="inv-alert"
                      type="number"
                      min="0"
                      value={form.alert_threshold}
                      onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {lowStock.length > 0 ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-destructive" />
          <p>
            {lowStock.length} article{lowStock.length > 1 ? "s" : ""} sous le seuil d'alerte :{" "}
            {lowStock.map((item) => item.name).join(", ")}.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="panel p-3">
          <p className="text-xs text-muted-foreground">Références</p>
          <p className="text-xl font-semibold">{items.length}</p>
        </div>
        <div className="panel p-3">
          <p className="text-xs text-muted-foreground">Unités en stock</p>
          <p className="text-xl font-semibold">{totalUnits}</p>
        </div>
        <div className="panel p-3">
          <p className="text-xs text-muted-foreground">Sous le seuil</p>
          <p className="text-xl font-semibold">{lowStock.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher un article, une catégorie, un emplacement…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant={category === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategory("ALL")}
        >
          Toutes
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={category === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Button>
        ))}
        <Button
          variant={alertOnly ? "destructive" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setAlertOnly((value) => !value)}
        >
          <AlertTriangle className="size-4" /> Stock bas
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement de l'inventaire…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? "Aucun article enregistré." : "Aucun article ne correspond à ce filtre."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="size-4 text-primary" /> {item.name}
                  </CardTitle>
                  {item.category ? <Badge variant="secondary">{item.category}</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {item.location ?? "Emplacement non précisé"} · seuil {item.alert_threshold}
                </p>
                <div className="flex items-center gap-3">
                  {isBureau ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        adjust.mutate({ id: item.id, quantity: Math.max(0, item.quantity - 1) })
                      }
                    >
                      <Minus className="size-4" />
                    </Button>
                  ) : null}
                  <span className="text-lg font-semibold">{item.quantity}</span>
                  {isBureau ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => adjust.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    >
                      <Plus className="size-4" />
                    </Button>
                  ) : null}
                  {item.quantity <= item.alert_threshold ? (
                    <Badge variant="destructive">Stock bas</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
