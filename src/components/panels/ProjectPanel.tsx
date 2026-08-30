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
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  slugify,
} from "@/lib/domain";

export type ProjectPanelValue = {
  id?: string;
  title?: string;
  description?: string | null;
  category_id?: string | null;
  status?: string;
  priority?: string;
  deadline?: string | null;
  progress_percent?: number | null;
};

const EMPTY = {
  title: "",
  description: "",
  category_id: "",
  status: "PLANNED",
  priority: "NORMAL",
  deadline: "",
  progress_percent: "0",
};

export function ProjectPanel({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectPanelValue | null;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(project?.id);

  const { data: categories = [] } = useQuery({
    queryKey: ["project-categories"],
    queryFn: async () =>
      (await supabase.from("project_categories").select("id,name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: project?.title ?? "",
      description: project?.description ?? "",
      category_id: project?.category_id ?? "",
      status: project?.status ?? "PLANNED",
      priority: project?.priority ?? "NORMAL",
      deadline: project?.deadline ?? "",
      progress_percent: String(project?.progress_percent ?? 0),
    });
    if (project?.id) {
      void supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", project.id)
        .then(({ data }) => setMembers((data ?? []).map((row) => row.user_id)));
    } else {
      setMembers([]);
    }
  }, [open, project]);

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
        category_id: form.category_id || null,
        status: form.status,
        priority: form.priority,
        deadline: form.deadline || null,
        progress_percent: Number(form.progress_percent) || 0,
      };

      let projectId = project?.id ?? null;
      if (editing && projectId) {
        const { error } = await supabase.from("projects").update(payload).eq("id", projectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert({
            ...payload,
            slug: `${slugify(form.title)}-${Date.now().toString(36)}`,
            owner_id: user?.id ?? null,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        projectId = data.id;
      }

      if (projectId) {
        const { data: existing } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", projectId);
        const before = (existing ?? []).map((row) => row.user_id);
        const toAdd = members.filter((id) => !before.includes(id));
        const toRemove = before.filter((id) => !members.includes(id));
        if (toAdd.length) {
          await supabase.from("project_members").insert(
            toAdd.map((user_id) => ({
              project_id: projectId!,
              user_id,
              project_role: "CONTRIBUTOR",
              participation_status: "ACTIVE",
            })),
          );
        }
        if (toRemove.length) {
          await supabase
            .from("project_members")
            .delete()
            .eq("project_id", projectId)
            .in("user_id", toRemove);
        }

        await notifyMembers({
          recipients: members,
          senderId: user?.id,
          kind: "SYSTEM",
          title: editing ? `Projet mis à jour : ${payload.title}` : `Nouveau projet : ${payload.title}`,
          message: editing
            ? "Les informations du projet viennent d'être modifiées."
            : "Vous avez été ajouté·e à ce projet.",
          linkUrl: `/projects/${projectId}`,
          entityType: "project",
          entityId: projectId,
        });
        if (!editing) {
          await notifyBureau({
            senderId: user?.id,
            kind: "SYSTEM",
            title: `Nouveau projet créé : ${payload.title}`,
            message: "Un nouveau projet a été ajouté à la cartographie.",
            linkUrl: `/projects/${projectId}`,
            entityType: "project",
            entityId: projectId,
          });
        }
      }

      toast.success(editing ? "Projet mis à jour." : "Projet créé.");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
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
      title={editing ? "Modifier le projet" : "Nouveau projet"}
      description="Les membres ajoutés sont notifiés et la mindmap se met à jour automatiquement."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le projet"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="pj-title">Titre</Label>
        <Input
          id="pj-title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pj-desc">Objectif</Label>
        <Textarea
          id="pj-desc"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Select
            value={form.category_id || "NONE"}
            onValueChange={(value) => setForm({ ...form, category_id: value === "NONE" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Sans catégorie</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
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
          <Label htmlFor="pj-deadline">Échéance</Label>
          <Input
            id="pj-deadline"
            type="date"
            value={form.deadline ?? ""}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Label htmlFor="pj-progress">Avancement (%)</Label>
          <Input
            id="pj-progress"
            type="number"
            min="0"
            max="100"
            value={form.progress_percent}
            onChange={(e) => setForm({ ...form, progress_percent: e.target.value })}
          />
        </div>
      ) : null}
      <MemberPicker selected={members} onChange={setMembers} />
    </SidePanel>
  );
}
