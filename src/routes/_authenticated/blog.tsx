import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Newspaper, Plus } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/blog")({
  head: () => ({
    meta: [
      { title: "Journal de l'association — La Voix du Chien" },
      {
        name: "description",
        content:
          "Articles et actualités de l'association : comptes rendus d'actions, conseils et petits progrès du terrain.",
      },
      { property: "og:title", content: "Journal de l'association — La Voix du Chien" },
      {
        property: "og:description",
        content: "Actualités, comptes rendus et conseils publiés par l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlogPage,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function BlogPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", status: "DRAFT" });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Le titre doit faire au moins 3 caractères.");
      const { error } = await supabase.from("blog_posts").insert({
        title: form.title.trim(),
        slug: `${slugify(form.title)}-${Date.now().toString(36)}`,
        excerpt: form.excerpt || null,
        content: form.content || null,
        status: form.status,
        author_id: user?.id ?? null,
        published_at: form.status === "PUBLISHED" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Article enregistré.");
      setOpen(false);
      setForm({ title: "", excerpt: "", content: "", status: "DRAFT" });
      void queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("blog_posts")
        .update({ status: "PUBLISHED", published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Article publié.");
      void queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Journal"
      subtitle="Articles et actualités de l'association"
      actions={
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
                <Label htmlFor="bl-title">Titre</Label>
                <Input
                  id="bl-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bl-exc">Chapeau</Label>
                <Input
                  id="bl-exc"
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bl-content">Contenu</Label>
                <Textarea
                  id="bl-content"
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              {isBureau ? (
                <div>
                  <Label htmlFor="bl-status">Statut</Label>
                  <select
                    id="bl-status"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="DRAFT">Brouillon</option>
                    <option value="PUBLISHED">Publié</option>
                  </select>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des articles…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun article pour le moment.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Newspaper className="size-4 text-primary" /> {post.title}
                  </CardTitle>
                  <Badge variant={post.status === "PUBLISHED" ? "default" : "secondary"}>
                    {post.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {post.excerpt ? <p className="text-muted-foreground">{post.excerpt}</p> : null}
                {post.content ? <p className="line-clamp-4 whitespace-pre-line">{post.content}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {post.published_at
                    ? `Publié le ${new Date(post.published_at).toLocaleDateString("fr-FR")}`
                    : `Créé le ${new Date(post.created_at).toLocaleDateString("fr-FR")}`}
                </p>
                {isBureau && post.status !== "PUBLISHED" ? (
                  <Button size="sm" variant="outline" onClick={() => publish.mutate(post.id)}>
                    Publier
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
