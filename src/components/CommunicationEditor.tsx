import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { explainDbError } from "@/lib/task-lifecycle";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { COMM_AUDIENCES, COMM_CHANNELS, COMM_STATUSES } from "@/lib/project-followup";

export type Communication = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  channel: string;
  target_audience: string;
  target_date: string | null;
  project_id: string | null;
  task_id: string | null;
  owner_id: string | null;
  visuals_url: string | null;
  internal_notes: string | null;
  created_by: string | null;
  validated_at: string | null;
  published_update_id: string | null;
};

export const COMMUNICATION_COLUMNS =
  "id,title,body,status,channel,target_audience,target_date,project_id,task_id,owner_id,visuals_url,internal_notes,created_by,validated_at,published_update_id";

type Person = { id: string; name: string };
const selectCls = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
const EMPTY = { title: "", body: "", status: "DRAFT", channel: "SOCIAL_POST", target_audience: "ALL_MEMBERS", target_date: "", project_id: "", task_id: "", owner_id: "", visuals_url: "", internal_notes: "" };

/** Personnes pouvant porter une communication : équipe du projet + Bureau (noms seulement). */
export function useCommunicationPeople(projectId: string | null) {
  return useQuery({
    queryKey: ["communication-people", projectId],
    queryFn: async (): Promise<Person[]> => {
      const people = new Map<string, string>();
      const bureau = await supabase.rpc("list_bureau_members");
      for (const p of ((bureau.data ?? []) as unknown as Person[])) people.set(p.id, p.name);
      if (projectId) {
        const rows = (await supabase.from("project_members").select("user_id").eq("project_id", projectId)).data ?? [];
        const ids = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id) && !people.has(id as string));
        if (ids.length) {
          const profiles = (await supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", ids)).data ?? [];
          for (const p of profiles) people.set(p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Membre");
        }
      }
      return [...people.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
  });
}

/**
 * Formulaire unique de préparation (console Bureau et fiche projet).
 * L'équipe ne choisit qu'entre brouillon et « à valider » ; la base refuse toute autre étape.
 */
export function CommunicationEditor({
  open,
  onOpenChange,
  editing,
  fixedProjectId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Communication | null;
  fixedProjectId?: string;
  onSaved: () => void;
}) {
  const { user, isBureau } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            title: editing.title,
            body: editing.body ?? "",
            status: editing.status,
            channel: editing.channel,
            target_audience: editing.target_audience,
            target_date: editing.target_date ?? "",
            project_id: editing.project_id ?? "",
            task_id: editing.task_id ?? "",
            owner_id: editing.owner_id ?? "",
            visuals_url: editing.visuals_url ?? "",
            internal_notes: editing.internal_notes ?? "",
          }
        : { ...EMPTY, project_id: fixedProjectId ?? "", owner_id: user?.id ?? "" },
    );
  }, [open, editing, fixedProjectId, user?.id]);

  const projectId = fixedProjectId ?? (form.project_id || null);
  const people = useCommunicationPeople(projectId);
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lite"],
    enabled: isBureau && !fixedProjectId,
    queryFn: async () => (await supabase.from("projects").select("id,title").order("title")).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["communication-tasks", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => (await supabase.from("tasks").select("id,title").eq("project_id", projectId!).order("title")).data ?? [],
  });

  const statuses = isBureau ? COMM_STATUSES : COMM_STATUSES.filter(([k]) => k === "DRAFT" || k === "IN_REVIEW");

  const save = async () => {
    if (form.title.trim().length < 2) return toast.error("Donnez un titre.");
    const visuals = form.visuals_url.trim();
    if (visuals && !(isSafeHttpUrl(visuals) && visuals.startsWith("https://"))) return toast.error("Le lien des visuels doit commencer par https:// (Canva, Drive…).");
    if (!isBureau && !projectId) return toast.error("Rattachez la communication à un projet.");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      status: form.status,
      channel: form.channel,
      target_audience: form.target_audience,
      target_date: form.target_date || null,
      project_id: projectId,
      task_id: projectId ? form.task_id || null : null,
      owner_id: form.owner_id || null,
      visuals_url: visuals || null,
      internal_notes: form.internal_notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("bureau_communications").update(payload).eq("id", editing.id)
      : await supabase.from("bureau_communications").insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(explainDbError(error));
    toast.success(form.status === "IN_REVIEW" ? "Communication transmise au Bureau pour validation." : "Communication enregistrée.");
    onOpenChange(false);
    onSaved();
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={editing ? "Modifier la communication" : "Préparer une communication"}>
      <div className="space-y-3">
        <div><Label htmlFor="cm-t">Titre</Label><Input id="cm-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label htmlFor="cm-b">Contenu</Label><Textarea id="cm-b" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cm-a">Public cible</Label>
            <select id="cm-a" className={selectCls} value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}>
              {COMM_AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="cm-c">Canal</Label>
            <select id="cm-c" className={selectCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {COMM_CHANNELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="cm-o">Responsable</Label>
            <select id="cm-o" className={selectCls} value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
              <option value="">À définir</option>
              {(people.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="cm-s">Étape</Label>
            <select id="cm-s" className={selectCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {statuses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div><Label htmlFor="cm-d">Date prévue (facultatif)</Label><Input id="cm-d" type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
          <div><Label htmlFor="cm-v">Lien des visuels (facultatif)</Label><Input id="cm-v" type="url" inputMode="url" placeholder="https://canva.com/… ou Drive" value={form.visuals_url} onChange={(e) => setForm({ ...form, visuals_url: e.target.value })} /></div>
        </div>
        {!fixedProjectId && isBureau ? (
          <div>
            <Label htmlFor="cm-p">Projet (facultatif)</Label>
            <select id="cm-p" className={selectCls} value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value, task_id: "" })}>
              <option value="">Aucun</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        ) : null}
        {projectId ? (
          <div>
            <Label htmlFor="cm-k">Tâche associée (facultatif)</Label>
            <select id="cm-k" className={selectCls} value={form.task_id} onChange={(e) => setForm({ ...form, task_id: e.target.value })}>
              <option value="">Aucune</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        ) : null}
        <div><Label htmlFor="cm-n">Notes de travail</Label><Textarea id="cm-n" rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">
          Visible par le Bureau{projectId ? " et l'équipe du projet" : ""} pendant la préparation. Le Bureau valide, puis publie dans « Actualités » ; rien n'est diffusé automatiquement ailleurs.
        </p>
        <Button className="w-full" onClick={save} disabled={saving}>Enregistrer</Button>
      </div>
    </SidePanel>
  );
}
