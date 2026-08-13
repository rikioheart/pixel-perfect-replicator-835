import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  formatDate,
} from "@/lib/domain";

export type PanelProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress_percent: number;
  deadline: string | null;
  start_date: string | null;
  category_id: string | null;
  owner_id: string | null;
  parent_project_id: string | null;
};

export type PanelTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_id: string | null;
  assigned_user_id: string | null;
  deadline: string | null;
};

export function ProjectDetailPanel({
  project,
  tasks,
  categories,
  people,
  parentTitle,
  childProjects,
  onOpenChange,
  onAddTask,
  onAddSubProject,
}: {
  project: PanelProject | null;
  tasks: PanelTask[];
  categories: Record<string, string>;
  people: Record<string, string>;
  parentTitle?: string | null;
  childProjects: { id: string; title: string }[];
  onOpenChange: (open: boolean) => void;
  onAddTask: (projectId: string) => void;
  onAddSubProject: (projectId: string) => void;
}) {
  return (
    <Sheet open={Boolean(project)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {project ? (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left">{project.title}</SheetTitle>
              <SheetDescription className="text-left">
                {project.description || "Aucun objectif renseigné."}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                </Badge>
                <Badge variant="secondary">
                  {PRIORITY_LABEL[project.priority] ?? project.priority}
                </Badge>
                {project.category_id && categories[project.category_id] ? (
                  <Badge variant="outline">{categories[project.category_id]}</Badge>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Avancement</span>
                  <span>{project.progress_percent ?? 0}%</span>
                </div>
                <Progress value={project.progress_percent ?? 0} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Début</dt>
                  <dd>{formatDate(project.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Échéance</dt>
                  <dd>{formatDate(project.deadline)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Responsable</dt>
                  <dd>{project.owner_id ? (people[project.owner_id] ?? "—") : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rattaché à</dt>
                  <dd>{parentTitle ?? "L'association"}</dd>
                </div>
              </dl>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tâches ({tasks.length})
                </p>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune tâche rattachée.</p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.map((task) => (
                      <li key={task.id} className="rounded-md border border-border p-2.5">
                        <Link
                          to="/tasks"
                          search={{ task: task.id }}
                          className="text-sm font-medium hover:underline"
                        >
                          {task.title}
                        </Link>
                        <p className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{TASK_STATUS_LABEL[task.status] ?? task.status}</span>
                          <span>· {PRIORITY_LABEL[task.priority] ?? task.priority}</span>
                          {task.assigned_user_id ? (
                            <span>· {people[task.assigned_user_id] ?? "Membre"}</span>
                          ) : null}
                          {task.deadline ? <span>· {formatDate(task.deadline)}</span> : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {childProjects.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sous-projets
                  </p>
                  <ul className="space-y-1 text-sm">
                    {childProjects.map((child) => (
                      <li key={child.id}>
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: child.id }}
                          className="hover:underline"
                        >
                          {child.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild size="sm">
                  <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                    Ouvrir la fiche projet
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAddTask(project.id)}>
                  Ajouter une tâche
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAddSubProject(project.id)}>
                  Ajouter un sous-projet
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
