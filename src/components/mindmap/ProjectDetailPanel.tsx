import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TASK_STATUS_LABEL,
  formatDate,
} from "@/lib/domain";
import {
  fetchProjectHistory,
  logAudit,
  validateProjectEdit,
  type ProjectEditValues,
  type UndoableAction,
} from "@/lib/mindmap-actions";


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

const NONE = "__none__";

export function ProjectDetailPanel({
  project,
  tasks,
  categories,
  people,
  categoryList,
  peopleList,
  userId,
  parentTitle,
  childProjects,
  onOpenChange,
  onAddTask,
  onAddSubProject,
  onChanged,
  onDeleted,
  onAction,
}: {
  project: PanelProject | null;
  tasks: PanelTask[];
  categories: Record<string, string>;
  people: Record<string, string>;
  categoryList: { id: string; name: string }[];
  peopleList: { id: string; name: string }[];
  userId: string;
  parentTitle?: string | null;
  childProjects: { id: string; title: string }[];
  onOpenChange: (open: boolean) => void;
  onAddTask: (projectId: string) => void;
  onAddSubProject: (projectId: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
  onAction: (action: UndoableAction) => void;
}) {

  const [tab, setTab] = useState("detail");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<ProjectEditValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!project) return;
    setTab("detail");
    setErrors({});
    setForm({
      title: project.title,
      description: project.description ?? "",
      status: project.status,
      priority: project.priority,
      category_id: project.category_id,
      deadline: project.deadline,
      owner_id: project.owner_id,
      progress_percent: project.progress_percent ?? 0,
    });
  }, [project]);

  const history = useQuery({
    queryKey: ["project-audit", project?.id],
    queryFn: () => fetchProjectHistory(project!.id),
    enabled: Boolean(project) && tab === "history",
  });


  const save = async () => {
    if (!project || !form) return;
    const found = validateProjectEdit(form);
    if (Object.keys(found).length > 0) {
      setErrors(found as Record<string, string>);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        category_id: form.category_id,
        deadline: form.deadline || null,
        owner_id: form.owner_id,
        progress_percent: Math.round(form.progress_percent),
      };
      const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await logAudit({
        actorId: userId || null,
        action: "project.update",
        entityType: "project",
        entityId: project.id,
        oldValues: { title: project.title, status: project.status },
        newValues: payload,
        metadata: { summary: `Projet « ${payload.title} » modifié` },
      });
      onAction({
        type: "project.update",
        label: `Modification du projet « ${payload.title} »`,
        projectId: project.id,
        previous: {
          title: project.title,
          description: project.description,
          status: project.status,
          priority: project.priority,
          category_id: project.category_id,
          deadline: project.deadline,
          owner_id: project.owner_id,
          progress_percent: project.progress_percent ?? 0,
        },
      });
      toast.success("Projet mis à jour.");
      onChanged();
      void history.refetch();
      setTab("detail");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const { data: fullRow } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project.id)
        .maybeSingle();
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await logAudit({
        actorId: userId || null,
        action: "project.delete",
        entityType: "project",
        entityId: project.id,
        oldValues: { title: project.title },
        metadata: { summary: `Projet « ${project.title} » supprimé` },
      });
      if (fullRow)
        onAction({
          type: "project.delete",
          label: `Suppression du projet « ${project.title} »`,
          row: fullRow as unknown as Record<string, unknown>,
        });
      toast.success("Projet supprimé.");
      setConfirmDelete(false);
      onDeleted();

    } finally {
      setSaving(false);
    }
  };

  if (!project) return null;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base">{project.title}</h3>
          <p className="mt-0.5 text-left text-xs text-muted-foreground">
            {project.description || "Aucun objectif renseigné."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label="Fermer le panneau"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">


            <Tabs value={tab} onValueChange={setTab} className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="detail" className="flex-1">
                  Détail
                </TabsTrigger>
                <TabsTrigger value="edit" className="flex-1">
                  Modifier
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  Historique
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detail" className="mt-5 space-y-5">
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
                          <Link to="/tasks" className="text-sm font-medium hover:underline">
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
              </TabsContent>

              <TabsContent value="edit" className="mt-5 space-y-4">
                {form ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Titre</Label>
                      <Input
                        id="edit-title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                      />
                      {errors['title'] ? (
                        <p className="text-xs text-destructive">{errors['title']}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-desc">Objectif</Label>
                      <Textarea
                        id="edit-desc"
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
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
                      <div className="space-y-2">
                        <Label>Catégorie</Label>
                        <Select
                          value={form.category_id ?? NONE}
                          onValueChange={(value) =>
                            setForm({ ...form, category_id: value === NONE ? null : value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Aucune" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Aucune</SelectItem>
                            {categoryList.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Responsable</Label>
                        <Select
                          value={form.owner_id ?? NONE}
                          onValueChange={(value) =>
                            setForm({ ...form, owner_id: value === NONE ? null : value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Non défini" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Non défini</SelectItem>
                            {peopleList.map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-deadline">Échéance</Label>
                        <Input
                          id="edit-deadline"
                          type="date"
                          value={form.deadline ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, deadline: e.target.value || null })
                          }
                        />
                        {errors['deadline'] ? (
                          <p className="text-xs text-destructive">{errors['deadline']}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-progress">Avancement (%)</Label>
                        <Input
                          id="edit-progress"
                          type="number"
                          min={0}
                          max={100}
                          value={form.progress_percent}
                          onChange={(e) =>
                            setForm({ ...form, progress_percent: Number(e.target.value) })
                          }
                        />
                        {errors['progress_percent'] ? (
                          <p className="text-xs text-destructive">{errors['progress_percent']}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between gap-2 pt-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDelete(true)}
                        disabled={saving}
                      >
                        Supprimer
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setTab("detail")}>
                          Annuler
                        </Button>
                        <Button size="sm" onClick={() => void save()} disabled={saving}>
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  </>
                ) : null}
              </TabsContent>

              <TabsContent value="history" className="mt-5 space-y-3">
                {history.isLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement de l'historique…</p>
                ) : (history.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune action enregistrée pour ce projet (ou historique réservé au Bureau).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(history.data ?? []).map((entry) => (
                      <li key={entry.id} className="rounded-md border border-border p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{entry.label}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {entry.scope === "task" ? "Tâche" : "Projet"}
                          </Badge>
                        </div>
                        {entry.summary ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{entry.summary}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(entry.at).toLocaleString("fr-FR")} ·{" "}
                          {entry.actorId ? (people[entry.actorId] ?? "Membre") : "Système"}
                        </p>
                      </li>
                    ))}
                  </ul>

                )}
              </TabsContent>
            </Tabs>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    « {project.title} » sera définitivement retiré de la mindmap. Les tâches et
                    sous-projets rattachés perdront ce rattachement.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void remove()}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
