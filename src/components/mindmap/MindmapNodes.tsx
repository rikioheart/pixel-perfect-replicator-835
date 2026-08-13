import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { PawPrint, FolderKanban, ListChecks, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/domain";

export type RootNodeData = { label: string; subtitle?: string };
export type ProjectNodeData = {
  label: string;
  status: string;
  progress: number;
  category?: string | null;
  taskCount: number;
};
export type TaskNodeData = {
  label: string;
  status: string;
  priority: string;
  assignee?: string | null;
};

export type MindmapNode =
  | Node<RootNodeData, "root">
  | Node<ProjectNodeData, "project">
  | Node<TaskNodeData, "task">;

const statusTone: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-800",
  ACTIVE: "bg-primary/10 text-primary",
  IN_PROGRESS: "bg-primary/10 text-primary",
  PENDING_VALIDATION: "bg-amber-100 text-amber-900",
  BLOCKED: "bg-destructive/10 text-destructive",
  ON_HOLD: "bg-muted text-muted-foreground",
};

function Tag({ children, tone }: { children: React.ReactNode; tone?: string | undefined }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone ?? "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function RootNode({ data }: NodeProps<Node<RootNodeData, "root">>) {
  return (
    <div className="surface-night flex w-64 items-center gap-3 rounded-xl px-4 py-3 shadow-lg">
      <PawPrint className="size-6 shrink-0" />
      <div className="min-w-0">
        <p className="font-display truncate text-sm">{data.label}</p>
        {data.subtitle ? <p className="truncate text-xs opacity-70">{data.subtitle}</p> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !bg-primary" />
    </div>
  );
}

export function ProjectNode({ data, selected }: NodeProps<Node<ProjectNodeData, "project">>) {
  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-card p-3 shadow-sm transition-shadow",
        selected ? "border-primary shadow-md" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !bg-primary" />
      <div className="flex items-start gap-2">
        <FolderKanban className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm font-medium leading-snug">{data.label}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag tone={statusTone[data.status]}>{PROJECT_STATUS_LABEL[data.status] ?? data.status}</Tag>
        {data.category ? <Tag>{data.category}</Tag> : null}
        <Tag>{data.taskCount} tâche{data.taskCount > 1 ? "s" : ""}</Tag>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${data.progress}%` }} />
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !bg-primary" />
    </div>
  );
}

export function TaskNode({ data, selected }: NodeProps<Node<TaskNodeData, "task">>) {
  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-card p-2.5 shadow-sm",
        selected ? "border-primary" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !bg-muted-foreground" />
      <div className="flex items-start gap-2">
        <ListChecks className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs font-medium leading-snug">{data.label}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag tone={statusTone[data.status]}>{TASK_STATUS_LABEL[data.status] ?? data.status}</Tag>
        <Tag>{PRIORITY_LABEL[data.priority] ?? data.priority}</Tag>
      </div>
      {data.assignee ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CircleUser className="size-3" /> {data.assignee}
        </p>
      ) : null}
    </div>
  );
}

export const mindmapNodeTypes = {
  root: RootNode,
  project: ProjectNode,
  task: TaskNode,
};
