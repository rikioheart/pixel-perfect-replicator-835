import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useConfigOptions } from "@/lib/config-options";
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

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — La Voix du Chien" },
      {
        name: "description",
        content:
          "Bibliothèque documentaire de l'association : statuts, comptes rendus, chartes et supports partagés aux membres.",
      },
      { property: "og:title", content: "Documents — La Voix du Chien" },
      {
        property: "og:description",
        content: "Statuts, comptes rendus et supports partagés aux membres.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

const EMPTY_DOC = { title: "", category: "", proof_type: "", url: "", visibility: "ASSOCIATION" };

function DocumentsPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_DOC);
  const categories = useConfigOptions("DOCUMENT_CATEGORY");
  const proofTypes = useConfigOptions("PROOF_TYPE");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 2) throw new Error("Le titre est obligatoire.");
      if (!/^https?:\/\//.test(form.url)) throw new Error("Le lien doit commencer par http(s)://");
      const { error } = await supabase.from("documents").insert({
        title: form.title.trim(),
        category: form.category || null,
        proof_type: form.proof_type || null,
        url: form.url,
        visibility: form.visibility,
        uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document ajouté.");
      setOpen(false);
      setForm(EMPTY_DOC);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document supprimé.");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Documents"
      subtitle="Bibliothèque partagée de l'association"
      actions={
        isBureau ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Ajouter un document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau document</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="doc-title">Titre</Label>
                  <Input
                    id="doc-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="doc-url">Lien</Label>
                  <Input
                    id="doc-url"
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="doc-cat">Catégorie</Label>
                    <Input
                      id="doc-cat"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="doc-vis">Visibilité</Label>
                    <select
                      id="doc-vis"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.visibility}
                      onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    >
                      <option value="ASSOCIATION">Tous les membres</option>
                      <option value="BUREAU">Bureau uniquement</option>
                    </select>
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
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des documents…</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun document partagé.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-primary" /> {doc.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {doc.category ? <Badge variant="secondary">{doc.category}</Badge> : null}
                  <Badge variant="outline">
                    {doc.visibility === "BUREAU" ? "Bureau" : "Membres"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  </Button>
                  {isBureau ? (
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => remove.mutate(doc.id)}>
                      <Trash2 className="size-4" />
                    </Button>
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
