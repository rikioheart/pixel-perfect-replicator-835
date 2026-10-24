import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidePanel } from "@/components/SidePanel";
import { MemberPicker } from "@/components/MemberPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/domain";
import { editableStatuses, emptyToNull, explainDbError, NO_ROW_UPDATED } from "@/lib/task-lifecycle";

export type TaskPanelValue = {
  id?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  deadline?: string | null;
  project_id?: string | null;
  assigned_user_id?: string | null;
};

export function TaskPanel({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  canValidate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskPanelValue | null;
  defaultProjectId?: string | null;
  /** Coordinateur du projet ou Bureau : peut poser « Terminée » ou « Archivée ». */
  canValidate?: boolean;
  onSaved?: () => void;
}) {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const editing = Boolean(task?.id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "NORMAL",
    deadline: "",
    project_id: "",
  });
  const [assignees, setAssignees] = useState<string[]>([]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () =>
      (await supabase.from("projects").select("id,title").order("title")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "TODO",
      priority: task?.priority ?? "NORMAL",
      deadline: task?.deadline ?? "",
      project_id: task?.project_id ?? defaultProjectId ?? "",
    });
    setAssignees(task?.assigned_user_id ? [task.assigned_user_id] : []);
  }, [open, task, defaultProjectId]);

  const save = async () => {
    if (form.title.trim().length < 3) {
      toast.error("Le titre doit faire au moins 3 caractères.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: emptyToNull(form.description),
        status: form.status,
        priority: form.priority,
        deadline: emptyToNull(form.deadline),
        project_id: emptyToNull(form.project_id),
        assigned_user_id: assignees[0] ?? null,
      };

      if (editing && task?.id) {
        const { data, error } = await supabase.from("tasks").update(payload).eq("id", task.id).select("id");
        if (error) throw new Error(explainDbError(error));
        if (!data || data.length === 0) throw new Error(NO_ROW_UPDATED);
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw new Error(explainDbError(error));
      }

      toast.success(editing ? "Tâche mise à jour." : "Tâche créée.");
      for (const key of ["tasks", "project-tasks", "project", "projects-lite", "mindmap"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = editableStatuses(TASK_STATUSES, canValidate ?? isBureau);
  if (!statusOptions.includes(form.status as (typeof TASK_STATUSES)[number])) {
    statusOptions.push(form.status as (typeof TASK_STATUSES)[number]);
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Modifier la tâche" : "Nouvelle tâche"}
      description="Le membre affecté et l'équipe projet reçoivent une notification."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer la tâche"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="tk-title">Titre</Label>
        <Input
          id="tk-title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tk-desc">Description</Label>
        <Textarea
          id="tk-desc"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Projet</Label>
        <Select
          value={form.project_id || "NONE"}
          onValueChange={(value) => setForm({ ...form, project_id: value === "NONE" ? "" : value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Sans projet</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {TASK_STATUS_LABEL[status]}
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
      <div className="space-y-2">
        <Label htmlFor="tk-deadline">Échéance</Label>
        <Input
          id="tk-deadline"
          type="date"
          value={form.deadline ?? ""}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </div>
      <MemberPicker label="Membre affecté" selected={assignees} onChange={setAssignees} single />
    </SidePanel>
  );
}
