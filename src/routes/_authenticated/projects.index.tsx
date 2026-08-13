import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  formatDate,
  slugify,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projets — La Voix du Chien" },
      {
        name: "description",
        content:
          "Tous les projets de l'association : catégories, statuts, échéances, équipes et avancement.",
      },
      { property: "og:title", content: "Projets — La Voix du Chien" },
      {
        property: "og:description",
        content: "Vue liste et kanban des projets associatifs de La Voix du Chien.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const { data: categories } = useQuery({
    queryKey: ["project-categories"],
    queryFn: async () => (await supabase.from("project_categories").select("*").order("name")).data ?? [],
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (
        await supabase
          .from("projects")
          .select("*, project_categories(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const filtered = (projects ?? []).filter(
    (project) =>
      (statusFilter === "ALL" || project.status === statusFilter) &&
      (categoryFilter === "ALL" || project.category_id === categoryFilter),
  );

  return (
    <AppShell
      title="Projets"
      subtitle="Chaque projet avance par petits progrès mesurables"
      actions={
        isBureau ? (
          <NewProjectDialog
            categories={categories ?? []}
            userId={user?.id ?? ""}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
          />
        ) : null
      }
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {PROJECT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {PROJECT_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes les catégories</SelectItem>
            {(categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun projet ne correspond aux filtres.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban">
          <div className="grid gap-4 lg:grid-cols-5">
            {PROJECT_STATUSES.map((status) => (
              <div key={status} className="panel p-3">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {PROJECT_STATUS_LABEL[status]}
                </p>
                <div className="space-y-3">
                  {filtered
                    .filter((project) => project.status === status)
                    .map((project) => (
                      <Link
                        key={project.id}
                        to="/projects/$projectId"
                        params={{ projectId: project.id }}
                        className="block rounded-md border border-border p-3 text-sm hover:bg-muted"
                      >
                        <p className="font-medium">{project.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(project.deadline)}
                        </p>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  progress_percent: number;
  project_categories: { name: string } | null;
};

function ProjectCard({ project }: { project: ProjectRow }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="panel block space-y-3 p-4 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-medium">{project.title}</h2>
        <Badge variant="outline">{PROJECT_STATUS_LABEL[project.status] ?? project.status}</Badge>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {project.description || "Sans description"}
      </p>
      <Progress value={project.progress_percent ?? 0} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{project.project_categories?.name ?? "Sans catégorie"}</span>
        <span>
          {PRIORITY_LABEL[project.priority] ?? project.priority} · {formatDate(project.deadline)}
        </span>
      </div>
    </Link>
  );
}

function NewProjectDialog({
  categories,
  userId,
  onCreated,
}: {
  categories: { id: string; name: string }[];
  userId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    status: "PLANNED",
    priority: "NORMAL",
    deadline: "",
  });

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    const { error } = await supabase.from("projects").insert({
      title: form.title,
      slug: `${slugify(form.title)}-${Date.now().toString(36)}`,
      description: form.description || null,
      category_id: form.category_id || null,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
      owner_id: userId,
      created_by: userId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Projet créé.");
    setOpen(false);
    setForm({
      title: "",
      description: "",
      category_id: "",
      status: "PLANNED",
      priority: "NORMAL",
      deadline: "",
    });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouveau projet</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Objectif</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={form.category_id}
                onValueChange={(value) => setForm({ ...form, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Échéance</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJECT_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABEL[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Créer le projet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
