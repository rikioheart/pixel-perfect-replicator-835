import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectPanel } from "@/components/panels/ProjectPanel";
import { Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  formatDate,
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
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
          <Button
            onClick={() => {
              setEditing(null);
              setPanelOpen(true);
            }}
          >
            Nouveau projet
          </Button>
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
                <ProjectCard
                  key={project.id}
                  project={project}
                  canEdit={isBureau}
                  onEdit={() => {
                    setEditing(project);
                    setPanelOpen(true);
                  }}
                />
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

      <ProjectPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        project={editing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
      />
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

function ProjectCard({
  project,
  canEdit,
  onEdit,
}: {
  project: ProjectRow;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="relative">
      {canEdit ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Modifier le projet"
          className="absolute right-2 top-2 z-10 min-h-9 min-w-9"
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
      ) : null}
      <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="panel block space-y-3 p-4 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2 pr-10">
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
    </div>
  );
}

