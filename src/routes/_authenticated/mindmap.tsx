import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Connection,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logAudit } from "@/lib/mindmap-actions";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mindmapNodeTypes, type MindmapNode } from "@/components/mindmap/MindmapNodes";
import {
  ProjectDetailPanel,
  type PanelProject,
  type PanelTask,
} from "@/components/mindmap/ProjectDetailPanel";
import {
  MindmapCreateDialog,
  ROOT_ID,
  type CreateTarget,
} from "@/components/mindmap/MindmapCreateDialog";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/mindmap")({
  head: () => ({
    meta: [
      { title: "Mindmap des projets — La Voix du Chien" },
      {
        name: "description",
        content:
          "Vue cartographique interactive des projets et tâches de l'association La Voix du Chien.",
      },
      { property: "og:title", content: "Mindmap des projets — La Voix du Chien" },
      {
        property: "og:description",
        content: "Cartographie interactive des projets, tâches et responsables de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MindmapPage,
});

type ProjectRow = PanelProject;
type TaskRow = PanelTask;

const COL_WIDTH = 320;
const V_GAP = 110;
const ALL = "ALL";

function buildGraph(
  projects: ProjectRow[],
  tasks: TaskRow[],
  categories: Record<string, string>,
  people: Record<string, string>,
  showTasks: boolean,
  allTasks: TaskRow[],
) {
  const nodes: MindmapNode[] = [];
  const edges: Edge[] = [];
  const visible = new Set(projects.map((p) => p.id));
  const childrenOf = new Map<string, ProjectRow[]>();

  for (const project of projects) {
    const parent =
      project.parent_project_id && visible.has(project.parent_project_id)
        ? project.parent_project_id
        : ROOT_ID;
    const list = childrenOf.get(parent) ?? [];
    list.push(project);
    childrenOf.set(parent, list);
  }

  let cursor = 0;

  const placeProject = (project: ProjectRow, depth: number): number => {
    const projectTasks = showTasks ? tasks.filter((t) => t.project_id === project.id) : [];
    const subProjects = childrenOf.get(project.id) ?? [];
    const start = cursor;
    const childCenters: number[] = [];

    projectTasks.forEach((task) => {
      const y = cursor;
      cursor += V_GAP;
      childCenters.push(y);
      nodes.push({
        id: task.id,
        type: "task",
        position: { x: (depth + 1) * COL_WIDTH + 40, y },
        data: {
          label: task.title,
          status: task.status,
          priority: task.priority,
          assignee: task.assigned_user_id ? (people[task.assigned_user_id] ?? null) : null,
        },
      });
      edges.push({
        id: `${project.id}-${task.id}`,
        source: project.id,
        target: task.id,
        type: "smoothstep",
      });
    });

    for (const child of subProjects) {
      const childY = placeProject(child, depth + 1);
      childCenters.push(childY);
      edges.push({
        id: `${project.id}-${child.id}`,
        source: project.id,
        target: child.id,
        type: "smoothstep",
        animated: child.status === "ACTIVE",
      });
    }

    let y: number;
    if (childCenters.length > 0) {
      y = (Math.min(...childCenters) + Math.max(...childCenters)) / 2;
    } else {
      y = cursor;
      cursor += V_GAP;
    }
    if (cursor === start) cursor = start + V_GAP;

    nodes.push({
      id: project.id,
      type: "project",
      position: { x: depth * COL_WIDTH + 40, y },
      data: {
        label: project.title,
        status: project.status,
        progress: project.progress_percent ?? 0,
        category: project.category_id ? (categories[project.category_id] ?? null) : null,
        taskCount: allTasks.filter((t) => t.project_id === project.id).length,
      },
    });
    return y;
  };

  const roots = childrenOf.get(ROOT_ID) ?? [];
  const rootCenters: number[] = [];
  for (const project of roots) {
    rootCenters.push(placeProject(project, 1));
    cursor += 30;
  }

  nodes.unshift({
    id: ROOT_ID,
    type: "root",
    position: {
      x: 0,
      y: rootCenters.length
        ? (Math.min(...rootCenters) + Math.max(...rootCenters)) / 2
        : 0,
    },
    data: {
      label: "La Voix du Chien",
      subtitle: `${projects.length} projet${projects.length > 1 ? "s" : ""} cartographié${projects.length > 1 ? "s" : ""}`,
    },
  });

  for (const project of roots) {
    edges.push({
      id: `root-${project.id}`,
      source: ROOT_ID,
      target: project.id,
      type: "smoothstep",
      animated: project.status === "ACTIVE",
    });
  }

  return { nodes, edges };
}

function MindmapPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [showTasks, setShowTasks] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [taskStatusFilter, setTaskStatusFilter] = useState(ALL);
  const [assigneeFilter, setAssigneeFilter] = useState(ALL);
  const [onlyLate, setOnlyLate] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [pendingLink, setPendingLink] = useState<{
    kind: "project" | "task";
    childId: string;
    parentId: string | null;
    description: string;
  } | null>(null);


  const { data, isLoading } = useQuery({
    queryKey: ["mindmap"],
    queryFn: async () => {
      const [projects, tasks, categories, profiles] = await Promise.all([
        supabase
          .from("projects")
          .select(
            "id,title,description,status,priority,progress_percent,deadline,start_date,category_id,owner_id,parent_project_id",
          )
          .order("created_at", { ascending: true }),
        supabase
          .from("tasks")
          .select("id,title,status,priority,project_id,assigned_user_id,deadline"),
        supabase.from("project_categories").select("id,name").order("name"),
        supabase.from("profiles").select("id,display_name,first_name,last_name"),
      ]);
      return {
        projects: (projects.data ?? []) as ProjectRow[],
        tasks: (tasks.data ?? []) as TaskRow[],
        categoryList: (categories.data ?? []) as { id: string; name: string }[],
        peopleList: (profiles.data ?? []).map((p) => ({
          id: p.id,
          name:
            p.display_name ??
            [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ??
            "Membre",
        })),
      };
    },
  });

  const categories = useMemo(
    () => Object.fromEntries((data?.categoryList ?? []).map((c) => [c.id, c.name])),
    [data],
  );
  const people = useMemo(
    () => Object.fromEntries((data?.peopleList ?? []).map((p) => [p.id, p.name || "Membre"])),
    [data],
  );

  const filteredProjects = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const term = search.trim().toLowerCase();
    return (data?.projects ?? []).filter((project) => {
      if (statusFilter !== ALL && project.status !== statusFilter) return false;
      if (categoryFilter !== ALL && project.category_id !== categoryFilter) return false;
      if (priorityFilter !== ALL && project.priority !== priorityFilter) return false;
      if (ownerFilter !== ALL && project.owner_id !== ownerFilter) return false;
      if (onlyLate) {
        const late =
          project.deadline &&
          project.deadline < today &&
          !["COMPLETED", "ARCHIVED"].includes(project.status);
        if (!late) return false;
      }
      if (term && !`${project.title} ${project.description ?? ""}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [data, search, statusFilter, categoryFilter, priorityFilter, ownerFilter, onlyLate]);

  const filteredTasks = useMemo(
    () =>
      (data?.tasks ?? []).filter((task) => {
        if (taskStatusFilter !== ALL && task.status !== taskStatusFilter) return false;
        if (assigneeFilter !== ALL && task.assigned_user_id !== assigneeFilter) return false;
        return true;
      }),
    [data, taskStatusFilter, assigneeFilter],
  );

  const graph = useMemo(() => {
    if (!data) return { nodes: [] as MindmapNode[], edges: [] as Edge[] };
    return buildGraph(
      filteredProjects,
      filteredTasks,
      categories,
      people,
      showTasks,
      data.tasks,
    );
  }, [data, filteredProjects, filteredTasks, categories, people, showTasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState<MindmapNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  const selectedProject =
    (data?.projects ?? []).find((project) => project.id === selectedProjectId) ?? null;
  const selectedTasks = (data?.tasks ?? []).filter((t) => t.project_id === selectedProjectId);
  const childProjects = (data?.projects ?? [])
    .filter((p) => p.parent_project_id === selectedProjectId)
    .map((p) => ({ id: p.id, title: p.title }));

  const refreshGraph = () => {
    void queryClient.invalidateQueries({ queryKey: ["mindmap"] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["project-audit"] });
  };

  const onConnect = (connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target || source === target) return;
    const projectsById = new Map((data?.projects ?? []).map((p) => [p.id, p]));
    const tasksById = new Map((data?.tasks ?? []).map((t) => [t.id, t]));
    const sourceLabel =
      source === ROOT_ID ? "L'association" : (projectsById.get(source)?.title ?? "");
    if (source !== ROOT_ID && !projectsById.has(source)) {
      toast.error("Seuls l'association ou un projet peuvent être parents.");
      return;
    }

    if (tasksById.has(target)) {
      const task = tasksById.get(target)!;
      if (source === ROOT_ID) {
        toast.error("Une tâche doit être rattachée à un projet.");
        return;
      }
      if (task.project_id === source) return;
      setPendingLink({
        kind: "task",
        childId: target,
        parentId: source,
        description: `Rattacher la tâche « ${task.title} » au projet « ${sourceLabel} » ?`,
      });
      return;
    }

    const child = projectsById.get(target);
    if (!child) return;
    const parentId = source === ROOT_ID ? null : source;
    if ((child.parent_project_id ?? null) === parentId) return;
    // Empêche les cycles : le parent ne peut pas être un descendant de l'enfant.
    let cursorId: string | null = parentId;
    while (cursorId) {
      if (cursorId === child.id) {
        toast.error("Ce rattachement créerait une boucle dans la hiérarchie.");
        return;
      }
      cursorId = projectsById.get(cursorId)?.parent_project_id ?? null;
    }
    setPendingLink({
      kind: "project",
      childId: child.id,
      parentId,
      description: `Rattacher le projet « ${child.title} » à ${
        parentId ? `« ${sourceLabel} »` : "l'association"
      } ?`,
    });
  };

  const applyLink = async () => {
    if (!pendingLink) return;
    const link = pendingLink;
    setPendingLink(null);
    if (link.kind === "project") {
      const { error } = await supabase
        .from("projects")
        .update({ parent_project_id: link.parentId })
        .eq("id", link.childId);
      if (error) {
        toast.error(error.message);
        return;
      }
      await logAudit({
        actorId: user?.id ?? null,
        action: "project.link",
        entityType: "project",
        entityId: link.childId,
        newValues: { parent_project_id: link.parentId },
        metadata: { summary: link.description },
      });
    } else {
      const { error } = await supabase
        .from("tasks")
        .update({ project_id: link.parentId })
        .eq("id", link.childId);
      if (error) {
        toast.error(error.message);
        return;
      }
      await logAudit({
        actorId: user?.id ?? null,
        action: "task.link",
        entityType: "project",
        entityId: link.parentId ?? link.childId,
        newValues: { task_id: link.childId, project_id: link.parentId },
        metadata: { summary: link.description },
      });
    }
    toast.success("Lien créé sur la mindmap.");
    refreshGraph();
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setCategoryFilter(ALL);
    setPriorityFilter(ALL);
    setOwnerFilter(ALL);
    setTaskStatusFilter(ALL);
    setAssigneeFilter(ALL);
    setOnlyLate(false);
  };

  return (
    <AppShell
      title="Mindmap des projets"
      subtitle="Cartographie interactive des projets, tâches et responsables"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateTarget({ kind: "task", parentId: filteredProjects[0]?.id ?? ROOT_ID })}
          >
            Nouvelle tâche
          </Button>
          <Button size="sm" onClick={() => setCreateTarget({ kind: "project", parentId: ROOT_ID })}>
            Nouveau projet
          </Button>
        </div>
      }
    >
      <div className="panel mb-4 space-y-3 p-3">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Recherche</Label>
            <Input
              placeholder="Titre ou objectif…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterSelect
            label="Statut du projet"
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="Tous les statuts"
            options={PROJECT_STATUSES.map((s) => ({
              value: s,
              label: PROJECT_STATUS_LABEL[s] ?? s,
            }))}
          />
          <FilterSelect
            label="Catégorie"
            value={categoryFilter}
            onChange={setCategoryFilter}
            allLabel="Toutes les catégories"
            options={(data?.categoryList ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            label="Priorité"
            value={priorityFilter}
            onChange={setPriorityFilter}
            allLabel="Toutes les priorités"
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] ?? p }))}
          />
          <FilterSelect
            label="Responsable projet"
            value={ownerFilter}
            onChange={setOwnerFilter}
            allLabel="Tous les responsables"
            options={(data?.peopleList ?? []).map((p) => ({
              value: p.id,
              label: p.name || "Membre",
            }))}
          />
          <FilterSelect
            label="Statut des tâches"
            value={taskStatusFilter}
            onChange={setTaskStatusFilter}
            allLabel="Tous les statuts"
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] ?? s }))}
          />
          <FilterSelect
            label="Assigné à"
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            allLabel="Tout le monde"
            options={(data?.peopleList ?? []).map((p) => ({
              value: p.id,
              label: p.name || "Membre",
            }))}
          />
          <div className="flex items-end gap-4">
            <div className="flex items-center gap-2">
              <Switch id="show-tasks" checked={showTasks} onCheckedChange={setShowTasks} />
              <Label htmlFor="show-tasks" className="text-xs">
                Tâches
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="only-late" checked={onlyLate} onCheckedChange={setOnlyLate} />
              <Label htmlFor="only-late" className="text-xs">
                En retard
              </Label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filteredProjects.length} projet(s) · {showTasks ? filteredTasks.length : 0} tâche(s)
            affichée(s)
          </p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser les filtres
          </Button>
        </div>
      </div>

      <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Chargement de la cartographie…
          </div>
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}

              nodeTypes={mindmapNodeTypes}
              fitView
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              onNodeDoubleClick={(_, node) => {
                if (node.type === "project") setSelectedProjectId(node.id);
                if (node.type === "root")
                  setCreateTarget({ kind: "project", parentId: ROOT_ID });
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <MiniMap pannable zoomable className="!bg-muted" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Astuce : double-cliquez sur un projet pour ouvrir son panneau détaillé, ou sur le nœud de
        l'association pour créer un projet rattaché.
        {isBureau ? "" : " Certaines créations peuvent être réservées au Bureau."}
      </p>

      <ProjectDetailPanel
        project={selectedProject}
        tasks={selectedTasks}
        categories={categories}
        people={people}
        categoryList={data?.categoryList ?? []}
        peopleList={(data?.peopleList ?? []).map((p) => ({ id: p.id, name: p.name || "Membre" }))}
        userId={user?.id ?? ""}
        parentTitle={
          selectedProject?.parent_project_id
            ? ((data?.projects ?? []).find((p) => p.id === selectedProject.parent_project_id)
                ?.title ?? null)
            : null
        }
        childProjects={childProjects}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectId(null);
        }}
        onChanged={refreshGraph}
        onDeleted={() => {
          setSelectedProjectId(null);
          refreshGraph();
        }}
        onAddTask={(projectId) => {
          setSelectedProjectId(null);
          setCreateTarget({ kind: "task", parentId: projectId });
        }}
        onAddSubProject={(projectId) => {
          setSelectedProjectId(null);
          setCreateTarget({ kind: "project", parentId: projectId });
        }}
      />

      <AlertDialog
        open={Boolean(pendingLink)}
        onOpenChange={(open) => {
          if (!open) setPendingLink(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le rattachement</AlertDialogTitle>
            <AlertDialogDescription>{pendingLink?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyLink()}>Créer le lien</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <MindmapCreateDialog
        target={createTarget}
        projects={(data?.projects ?? []).map((p) => ({ id: p.id, title: p.title }))}
        categories={data?.categoryList ?? []}
        people={(data?.peopleList ?? []).map((p) => ({ id: p.id, name: p.name || "Membre" }))}
        userId={user?.id ?? ""}
        onOpenChange={(open) => {
          if (!open) setCreateTarget(null);
        }}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["mindmap"] });
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
