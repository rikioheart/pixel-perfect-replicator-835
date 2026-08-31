import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidePanel } from "@/components/SidePanel";
import { MemberPicker } from "@/components/MemberPicker";
import { notifyBureau, notifyMembers } from "@/lib/collab-notify";
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
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskPanelValue | null;
  defaultProjectId?: string | null;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
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
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        deadline: form.deadline || null,
        project_id: form.project_id || null,
        assigned_user_id: assignees[0] ?? null,
      };

      let taskId = task?.id ?? null;
      if (editing && taskId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        taskId = data.id;
      }

      const recipients = [...assignees];
      if (payload.project_id) {
        const { data: projectMembers } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", payload.project_id);
        recipients.push(...(projectMembers ?? []).map((row) => row.user_id));
      }
      await notifyMembers({
        recipients,
        senderId: user?.id,
        kind: "SYSTEM",
        title: editing ? `Tâche mise à jour : ${payload.title}` : `Nouvelle tâche : ${payload.title}`,
        message: editing
          ? "Cette tâche vient d'être modifiée."
          : "Une nouvelle tâche a été créée sur votre projet.",
        linkUrl: "/tasks",
        entityType: "task",
        entityId: taskId,
      });
      if (!editing) {
        await notifyBureau({
          senderId: user?.id,
          kind: "SYSTEM",
          title: `Nouvelle tâche : ${payload.title}`,
          message: "Une tâche a été ajoutée et apparaît sur la mindmap.",
          linkUrl: "/tasks",
          entityType: "task",
          entityId: taskId,
        });
      }

      toast.success(editing ? "Tâche mise à jour." : "Tâche créée.");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["mindmap"] });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

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
              {TASK_STATUSES.map((status) => (
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
