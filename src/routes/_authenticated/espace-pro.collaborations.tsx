import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/espace-pro/collaborations")({
  head: () => ({
    meta: [
      { title: "Collaborations — La Voix du Chien" },
      { name: "description", content: "Vos collaborations avec l'association, à rendre publiques ou non sur votre carte." },
      { property: "og:title", content: "Collaborations — La Voix du Chien" },
      { property: "og:description", content: "Collaborations entre professionnels et association." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollabPage,
});

function CollabPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", happened_on: "", is_public: false });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-collabs", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("professional_collaborations").select("*").eq("professional_id", user!.id).order("happened_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["my-collabs"] });

  const add = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Donnez un titre.");
      const { error } = await supabase.from("professional_collaborations").insert({
        professional_id: user!.id, title: form.title.trim(), description: form.description.trim() || null,
        happened_on: form.happened_on || null, is_public: form.is_public,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ title: "", description: "", happened_on: "", is_public: false }); toast.success("Collaboration ajoutée."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_public }: { id: string; is_public: boolean }) => {
      const { error } = await supabase.from("professional_collaborations").update({ is_public }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professional_collaborations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return (
    <AppShell title="Collaborations" subtitle="Seules celles marquées « publique » apparaissent sur votre carte">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {isLoading ? <LoadingState rows={3} /> : rows.length === 0 ? (
            <EmptyState title="Aucune collaboration" message="Ateliers co-animés, interventions, dons… ajoutez-les ici." />
          ) : rows.map((c) => (
            <div key={c.id} className="panel flex items-start justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{c.title}</p>
                {c.description ? <p className="text-muted-foreground">{c.description}</p> : null}
                <Badge variant={c.is_public ? "default" : "outline"} className="mt-1">{c.is_public ? "Publique" : "Interne"}</Badge>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label={c.is_public ? "Rendre interne" : "Rendre publique"} onClick={() => toggle.mutate({ id: c.id, is_public: !c.is_public })}>
                  {c.is_public ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => remove.mutate(c.id)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="panel space-y-3 p-4">
          <h2 className="font-display text-lg">Nouvelle collaboration</h2>
          <div><Label htmlFor="co-t">Titre</Label><Input id="co-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label htmlFor="co-d">Description</Label><Textarea id="co-d" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label htmlFor="co-date">Date</Label><Input id="co-date" type="date" value={form.happened_on} onChange={(e) => setForm({ ...form, happened_on: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /> Afficher sur ma carte publique
          </label>
          <Button className="w-full gap-2" onClick={() => add.mutate()} disabled={add.isPending}><Plus className="size-4" aria-hidden /> Ajouter</Button>
        </div>
      </div>
    </AppShell>
  );
}
