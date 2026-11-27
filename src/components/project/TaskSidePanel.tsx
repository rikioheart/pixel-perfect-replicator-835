import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberPicker } from "@/components/MemberPicker";
import { TaskCard } from "@/components/TaskCard";
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/domain";
import { EDITABLE_TASK_STATUSES, taskCopy } from "@/lib/project-plan";
import { explainDbError } from "@/lib/task-lifecycle";
import { planKey, useProjectPlan } from "./ProjectPlan";

const NONE = "__none";

/** Panneau latéral : modifier, affecter, dupliquer ou supprimer une tâche sans quitter le projet. */
export function TaskSidePanel({ projectId, taskId, onClose, userId, isBureau, canManage }: { projectId: string; taskId: string | undefined; onClose: () => void; userId: string; isBureau: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const { data } = useProjectPlan(projectId);
  const task = data?.tasks.find((t) => t.id === taskId);
  const [form, setForm] = useState({ title: "", description: "", priority: "NORMAL", deadline: "", status: "TODO", milestone_id: NONE, theme_id: NONE });
  const [people, setPeople] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task || !data) return;
    setForm({ title: task.title, description: task.description ?? "", priority: task.priority, deadline: task.deadline ?? "", status: task.status, milestone_id: task.milestone_id ?? NONE, theme_id: task.theme_id ?? NONE });
    const ids = data.assignees.filter((a) => a.task_id === task.id).map((a) => a.user_id);
    setPeople(ids.length ? ids : task.assigned_user_id ? [task.assigned_user_id] : []);
  }, [task?.id, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit = Boolean(task) && (canManage || task?.created_by === userId || task?.assigned_user_id === userId);
  const refresh = () => { void qc.invalidateQueries({ queryKey: planKey(projectId) }); void qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }); void qc.invalidateQueries({ queryKey: ["project", projectId] }); };

  const save = async () => {
    if (!task) return;
    if (form.title.trim().length < 2) { toast.error("Donnez un titre à la tâche."); return; }
    setBusy(true);
    const patch: Record<string, unknown> = {
      title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, deadline: form.deadline || null,
      milestone_id: form.milestone_id === NONE ? null : form.milestone_id, theme_id: form.theme_id === NONE ? null : form.theme_id,
    };
    if (form.status !== task.status) patch["status"] = form.status;
    if (canManage) patch["assigned_user_id"] = people[0] ?? null;
    const { data: rows, error } = await supabase.from("tasks").update(patch as never).eq("id", task.id).select("id");
    if (error || !rows?.length) { setBusy(false); toast.error(error ? explainDbError(error) : "Cette modification est réservée au responsable de la tâche ou du projet."); return; }
    if (canManage) {
      const current = data!.assignees.filter((a) => a.task_id === task.id).map((a) => a.user_id);
      const add = people.filter((p) => !current.includes(p));
      const remove = current.filter((p) => !people.includes(p));
      if (add.length) { const r = await supabase.from("task_assignees").insert(add.map((user_id) => ({ task_id: task.id, user_id }))); if (r.error) toast.error(explainDbError(r.error)); }
      if (remove.length) { const r = await supabase.from("task_assignees").delete().eq("task_id", task.id).in("user_id", remove); if (r.error) toast.error(explainDbError(r.error)); }
    }
    setBusy(false);
    toast.success("Tâche enregistrée.");
    refresh();
  };

  const duplicate = async () => {
    if (!task) return;
    const { data: copy, error } = await supabase.from("tasks").insert(taskCopy(task, userId) as never).select("id").single();
    if (error || !copy) { toast.error(explainDbError(error ?? { message: "" })); return; }
    toast.success("Tâche dupliquée, à affecter.");
    refresh();
  };

  const remove = async () => {
    if (!task || !confirm("Supprimer définitivement cette tâche ?")) return;
    const { data: rows, error } = await supabase.from("tasks").delete().eq("id", task.id).select("id");
    if (error || !rows?.length) { toast.error(error ? explainDbError(error) : "La suppression est réservée au Bureau et aux coordinateurs du projet."); return; }
    toast.success("Tâche supprimée.");
    refresh();
    onClose();
  };

  const statusOptions = Array.from(new Set([task?.status ?? "TODO", ...EDITABLE_TASK_STATUSES]));

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{task?.title ?? "Tâche"}</SheetTitle>
          <SheetDescription>{task ? "Modifiez la tâche sans quitter le projet." : "Cette tâche n'est pas visible ou n'existe plus."}</SheetDescription>
        </SheetHeader>
        {task && data ? (
          <div className="mt-4 space-y-4 px-4 pb-6">
            <fieldset disabled={!canEdit || busy} className="space-y-3">
              <div className="space-y-1"><Label htmlFor="tp-title">Titre</Label><Input id="tp-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="tp-desc">Description</Label><Textarea id="tp-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map((s) => <SelectItem key={s} value={s} disabled={!EDITABLE_TASK_STATUSES.includes(s as never) && s !== task.status}>{TASK_STATUS_LABEL[s] ?? s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Priorité</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Étape</Label>
                  <Select value={form.milestone_id} onValueChange={(v) => setForm({ ...form, milestone_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Sans étape</SelectItem>{data.milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Catégorie</Label>
                  <Select value={form.theme_id} onValueChange={(v) => setForm({ ...form, theme_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Sans catégorie</SelectItem>{data.themes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label htmlFor="tp-deadline">Échéance</Label><Input id="tp-deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
              </div>
            </fieldset>
            {canManage ? <MemberPicker label="Personnes affectées" selected={people} onChange={setPeople} /> : null}
            <div className="flex flex-wrap gap-2">
              {canEdit ? <Button onClick={() => void save()} disabled={busy}>Enregistrer</Button> : null}
              {canEdit ? <Button variant="outline" onClick={() => void duplicate()}><Copy className="mr-1 size-4" /> Dupliquer</Button> : null}
              {canManage ? <Button variant="ghost" className="text-destructive" onClick={() => void remove()}><Trash2 className="mr-1 size-4" /> Supprimer</Button> : null}
            </div>
            <TaskCard task={task} currentUserId={userId} isBureau={isBureau} canValidate={canManage} showProject={false} onChanged={refresh} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
