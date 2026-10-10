import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HandHeart, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";
import { UpdatesWall } from "@/components/UpdatesWall";
import { HelpWizard } from "@/components/HelpWizard";
import { UPDATE_KINDS } from "@/lib/contributions";

export const Route = createFileRoute("/_authenticated/avancees")({
  head: () => ({
    meta: [
      { title: "Ce que nous construisons ensemble — La Voix du Chien" },
      { name: "description", content: "Projets qui avancent, actions réalisées, partenariats et besoins d'aide de l'association." },
      { property: "og:title", content: "Ce que nous construisons ensemble — La Voix du Chien" },
      { property: "og:description", content: "Le mur des avancées de l'association." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WallPage,
});

function WallPage() {
  const { user, isBureau, profile } = useAuth();
  const qc = useQueryClient();
  const canPost = isBureau || isPro;
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [form, setForm] = useState({ kind: "PROJET", title: "", body: "", is_public: false });

  const post = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Donnez un titre.");
      const { error } = await supabase.from("association_updates").insert({
        kind: form.kind, title: form.title.trim(), body: form.body.trim() || null, is_public: form.is_public, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Avancée publiée."); setOpen(false); setForm({ kind: "PROJET", title: "", body: "", is_public: false }); void qc.invalidateQueries({ queryKey: ["association-updates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Ce que nous construisons ensemble" subtitle="Les avancées de l'association, sans compétition"
      actions={<>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setHelp(true)}><HandHeart className="size-4" aria-hidden /> Je veux aider</Button>
        {canPost ? <Button size="sm" className="gap-2" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden /> Partager une avancée</Button> : null}
      </>}>
      <UpdatesWall limit={50} />
      <HelpWizard open={help} onOpenChange={setHelp} />
      <SidePanel open={open} onOpenChange={setOpen} title="Partager une avancée">
        <div className="space-y-3">
          <div>
            <Label htmlFor="up-k">Type</Label>
            <select id="up-k" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {UPDATE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div><Label htmlFor="up-t">Titre</Label><Input id="up-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label htmlFor="up-b">Détails</Label><Textarea id="up-b" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} /> Visible aussi sur la page publique de l'association
          </label>
          <Button onClick={() => post.mutate()} disabled={post.isPending}>Publier</Button>
        </div>
      </SidePanel>
    </AppShell>
  );
}
