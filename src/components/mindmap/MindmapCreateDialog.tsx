import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  slugify,
} from "@/lib/domain";

export const ROOT_ID = "root";

export type CreateTarget = {
  kind: "project" | "task";
  /** Projet parent (ou "root" pour rattacher directement à l'association). */
  parentId: string;
};

export function MindmapCreateDialog({
  target,
  projects,
  categories,
  people,
  userId,
  onOpenChange,
  onCreated,
}: {
  target: CreateTarget | null;
  projects: { id: string; title: string }[];
  categories: { id: string; name: string }[];
  people: { id: string; name: string }[];
  userId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<"project" | "task">("project");
  const [parentId, setParentId] = useState<string>(ROOT_ID);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState({
    title: "",
    description: "",
    category_id: "",
    status: "PLANNED",
    priority: "NORMAL",
    deadline: "",
  });
  const [task, setTask] = useState({
    title: "",
    description: "",
    priority: "NORMAL",
    deadline: "",
    assigned_user_id: "",
  });

  useEffect(() => {
    if (!target) return;
    setKind(target.kind);
    setParentId(target.parentId);
  }, [target]);

  const close = () => onOpenChange(false);

  const submit = async () => {
    setSaving(true);
    try {
      if (kind === "project") {
        if (!project.title.trim()) {
          toast.error("Le titre du projet est obligatoire.");
          return;
        }
        const { data: created, error } = await supabase
          .from("projects")
          .insert({
            title: project.title.trim(),
            slug: `${slugify(project.title)}-${Date.now().toString(36)}`,
            description: project.description || null,
            category_id: project.category_id || null,
            status: project.status,
            priority: project.priority,
            deadline: project.deadline || null,
            parent_project_id: parentId === ROOT_ID ? null : parentId,
            owner_id: userId || null,
            created_by: userId || null,
          })
          .select("id")
          .single();
        if (error) {
          toast.error(error.message);
          return;
        }
        if (created) {
          await logAudit({
            actorId: userId || null,
            action: "project.create",
            entityType: "project",
            entityId: created.id,
            newValues: { title: project.title.trim(), status: project.status },
            metadata: { summary: `Projet « ${project.title.trim()} » créé` },
          });
        }
        toast.success("Projet créé et relié à la carte.");

      } else {
        if (!task.title.trim()) {
          toast.error("Le titre de la tâche est obligatoire.");
          return;
        }
        if (parentId === ROOT_ID) {
          toast.error("Choisissez le projet auquel rattacher la tâche.");
          return;
        }
        const { error } = await supabase.from("tasks").insert({
          title: task.title.trim(),
          description: task.description || null,
          project_id: parentId,
          priority: task.priority,
          deadline: task.deadline || null,
          assigned_user_id: task.assigned_user_id || null,
          created_by: userId || null,
          status: "TODO",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Tâche créée et reliée au projet.");
      }
      setProject({
        title: "",
        description: "",
        category_id: "",
        status: "PLANNED",
        priority: "NORMAL",
        deadline: "",
      });
      setTask({
        title: "",
        description: "",
        priority: "NORMAL",
        deadline: "",
        assigned_user_id: "",
      });
      onCreated();
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter à la mindmap</DialogTitle>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(value) => setKind(value as "project" | "task")}>
          <TabsList className="w-full">
            <TabsTrigger value="project" className="flex-1">
              Projet
            </TabsTrigger>
            <TabsTrigger value="task" className="flex-1">
              Tâche
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Relier à</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un rattachement" />
              </SelectTrigger>
              <SelectContent>
                {kind === "project" ? (
                  <SelectItem value={ROOT_ID}>L'association (nœud racine)</SelectItem>
                ) : null}
                {projects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {kind === "project"
                ? "Le nouveau projet sera relié visuellement à l'association ou au projet choisi."
                : "La tâche apparaîtra reliée au projet choisi."}
            </p>
          </div>

          {kind === "project" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="mm-title">Titre</Label>
                <Input
                  id="mm-title"
                  value={project.title}
                  onChange={(e) => setProject({ ...project, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-desc">Objectif</Label>
                <Textarea
                  id="mm-desc"
                  rows={3}
                  value={project.description}
                  onChange={(e) => setProject({ ...project, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={project.category_id}
                    onValueChange={(value) => setProject({ ...project, category_id: value })}
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
                  <Label htmlFor="mm-deadline">Échéance</Label>
                  <Input
                    id="mm-deadline"
                    type="date"
                    value={project.deadline}
                    onChange={(e) => setProject({ ...project, deadline: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={project.status}
                    onValueChange={(value) => setProject({ ...project, status: value })}
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
                    value={project.priority}
                    onValueChange={(value) => setProject({ ...project, priority: value })}
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
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="mm-task-title">Titre de la tâche</Label>
                <Input
                  id="mm-task-title"
                  value={task.title}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-task-desc">Description</Label>
                <Textarea
                  id="mm-task-desc"
                  rows={3}
                  value={task.description}
                  onChange={(e) => setTask({ ...task, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select
                    value={task.priority}
                    onValueChange={(value) => setTask({ ...task, priority: value })}
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
                  <Label htmlFor="mm-task-deadline">Échéance</Label>
                  <Input
                    id="mm-task-deadline"
                    type="date"
                    value={task.deadline}
                    onChange={(e) => setTask({ ...task, deadline: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Responsable</Label>
                  <Select
                    value={task.assigned_user_id}
                    onValueChange={(value) => setTask({ ...task, assigned_user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Non assignée" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {kind === "project" ? "Créer le projet" : "Créer la tâche"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
