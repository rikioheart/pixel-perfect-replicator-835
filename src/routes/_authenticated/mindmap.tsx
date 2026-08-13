import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { mindmapNodeTypes, type MindmapNode } from "@/components/mindmap/MindmapNodes";
import { PROJECT_STATUS_LABEL } from "@/lib/domain";

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

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  category_id: string | null;
};
type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_id: string | null;
  assigned_user_id: string | null;
};

const ROOT_X = 0;
const PROJECT_X = 340;
const TASK_X = 680;
const V_GAP = 110;

function buildGraph(
  projects: ProjectRow[],
  tasks: TaskRow[],
  categories: Record<string, string>,
  people: Record<string, string>,
  showTasks: boolean,
) {
  const nodes: MindmapNode[] = [];
  const edges: Edge[] = [];
  let cursor = 0;

  for (const project of projects) {
    const projectTasks = showTasks ? tasks.filter((t) => t.project_id === project.id) : [];
    const blockHeight = Math.max(1, projectTasks.length) * V_GAP;
    const projectY = cursor + blockHeight / 2 - V_GAP / 2;

    nodes.push({
      id: project.id,
      type: "project",
      position: { x: PROJECT_X, y: projectY },
      data: {
        label: project.title,
        status: project.status,
        progress: project.progress_percent ?? 0,
        category: project.category_id ? (categories[project.category_id] ?? null) : null,
        taskCount: tasks.filter((t) => t.project_id === project.id).length,
      },
    });
    edges.push({
      id: `root-${project.id}`,
      source: "root",
      target: project.id,
      type: "smoothstep",
      animated: project.status === "ACTIVE",
    });

    projectTasks.forEach((task, index) => {
      nodes.push({
        id: task.id,
        type: "task",
        position: { x: TASK_X, y: cursor + index * V_GAP },
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

    cursor += blockHeight + 40;
  }

  nodes.unshift({
    id: "root",
    type: "root",
    position: { x: ROOT_X, y: Math.max(0, cursor / 2 - 40) },
    data: {
      label: "La Voix du Chien",
      subtitle: `${projects.length} projet${projects.length > 1 ? "s" : ""} cartographié${projects.length > 1 ? "s" : ""}`,
    },
  });

  return { nodes, edges };
}

function MindmapPage() {
  const navigate = useNavigate();
  const [showTasks, setShowTasks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["mindmap"],
    queryFn: async () => {
      const [projects, tasks, categories, profiles] = await Promise.all([
        supabase
          .from("projects")
          .select("id,title,status,progress_percent,category_id")
          .order("created_at", { ascending: true }),
        supabase.from("tasks").select("id,title,status,priority,project_id,assigned_user_id"),
        supabase.from("project_categories").select("id,name"),
        supabase.from("profiles").select("id,display_name,first_name,last_name"),
      ]);
      return {
        projects: (projects.data ?? []) as ProjectRow[],
        tasks: (tasks.data ?? []) as TaskRow[],
        categories: Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name])),
        people: Object.fromEntries(
          (profiles.data ?? []).map((p) => [
            p.id,
            p.display_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ") ?? "Membre",
          ]),
        ),
      };
    },
  });

  const graph = useMemo(() => {
    if (!data) return { nodes: [] as MindmapNode[], edges: [] as Edge[] };
    const projects =
      statusFilter === "ALL"
        ? data.projects
        : data.projects.filter((p) => p.status === statusFilter);
    return buildGraph(projects, data.tasks, data.categories, data.people, showTasks);
  }, [data, showTasks, statusFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState<MindmapNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  const statuses = ["ALL", ...Object.keys(PROJECT_STATUS_LABEL)];

  return (
    <AppShell
      title="Mindmap des projets"
      subtitle="Cartographie interactive des projets, tâches et responsables"
      actions={
        <Button
          variant={showTasks ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTasks((v) => !v)}
        >
          {showTasks ? "Masquer les tâches" : "Afficher les tâches"}
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
          >
            {status === "ALL" ? "Tous" : (PROJECT_STATUS_LABEL[status] ?? status)}
          </Button>
        ))}
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
              nodeTypes={mindmapNodeTypes}
              fitView
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              onNodeDoubleClick={(_, node) => {
                if (node.type === "project") {
                  void navigate({
                    to: "/projects/$projectId",
                    params: { projectId: node.id },
                  });
                }
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
        Astuce : double-cliquez sur un projet pour ouvrir sa fiche détaillée. Déplacez les nœuds
        librement pour réorganiser la carte.
      </p>
    </AppShell>
  );
}
