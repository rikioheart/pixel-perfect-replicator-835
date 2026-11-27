import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemberOptions } from "@/components/MemberPicker";
import { TASK_STATUS_LABEL, formatDate } from "@/lib/domain";
import { sortMilestones, milestoneState } from "@/lib/project-followup";
import { MILESTONE_STATUSES, MILESTONE_STATUS_LABEL, progressBreakdown, taskCopy, type Progress as P } from "@/lib/project-plan";
import { explainDbError } from "@/lib/task-lifecycle";

export type PlanMilestone = { id: string; title: string; due_date: string | null; done_at: string | null; description: string | null; deliverable: string | null; status: string; project_id: string };
export type PlanTheme = { id: string; name: string; color: string | null };
export type PlanTaskRow = {
  id: string; title: string; description: string | null; status: string; priority: string; deadline: string | null;
  assigned_user_id: string | null; created_by: string | null; project_id: string | null; rejection_reason: string | null;
  milestone_id: string | null; theme_id: string | null;
};
export type PlanData = { milestones: PlanMilestone[]; themes: PlanTheme[]; tasks: PlanTaskRow[]; assignees: { task_id: string; user_id: string }[] };

export const planKey = (projectId: string) => ["project-plan", projectId];

export function useProjectPlan(projectId: string) {
  return useQuery({
    queryKey: planKey(projectId),
    queryFn: async (): Promise<PlanData> => {
      const [m, th, t] = await Promise.all([
        supabase.from("project_milestones").select("id,title,due_date,done_at,description,deliverable,status,project_id").eq("project_id", projectId),
        supabase.from("project_themes").select("id,name,color").eq("project_id", projectId).order("name"),
        supabase.from("tasks").select("id,title,description,status,priority,deadline,assigned_user_id,created_by,project_id,rejection_reason,milestone_id,theme_id").eq("project_id", projectId).order("created_at"),
      ]);
      const tasks = (t.data ?? []) as PlanTaskRow[];
      const a = tasks.length ? await supabase.from("task_assignees").select("task_id,user_id").in("task_id", tasks.map((x) => x.id)) : { data: [] };
      return { milestones: sortMilestones((m.data ?? []) as PlanMilestone[]), themes: (th.data ?? []) as PlanTheme[], tasks, assignees: a.data ?? [] };
    },
  });
}

function Bar({ label, p }: { label: string; p: P }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span className="min-w-0 truncate">{label}</span><span className="shrink-0">{p.percent === null ? "—" : `${p.percent}% · ${p.done}/${p.counted}`}</span></div>
      {p.percent === null ? null : <Progress tone="collective" value={p.percent} aria-label={`${label} : ${p.done} sur ${p.counted}`} />}
    </div>
  );
}

/** Étapes, catégories, carte et progression du projet ; ouvre le panneau de tâche sans quitter la page. */
export function ProjectPlan({ projectId, canManage, userId, onOpenTask }: { projectId: string; canManage: boolean; userId: string; onOpenTask: (id: string) => void }) {
  const qc = useQueryClient();
  const { data } = useProjectPlan(projectId);
  const { data: members = [] } = useMemberOptions();
  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const [editing, setEditing] = useState<Partial<PlanMilestone> | null>(null);
  const [themeName, setThemeName] = useState("");
  const [mode, setMode] = useState<"classique" | "detaillee">("classique");
  const refresh = () => { void qc.invalidateQueries({ queryKey: planKey(projectId) }); void qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }); void qc.invalidateQueries({ queryKey: ["project", projectId] }); };
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error } = await p;
    if (error) toast.error(explainDbError(error)); else { if (ok) toast.success(ok); refresh(); }
  };

  if (!data) return null;
  const { milestones, themes, tasks, assignees } = data;
  const br = progressBreakdown(tasks, milestones.map((m) => m.id), themes.map((t) => t.id));
  const pm = new Map(br.byMilestone.map((g) => [g.id, g]));
  const peopleOf = (taskId: string, fallback: string | null) => {
    const ids = assignees.filter((a) => a.task_id === taskId).map((a) => a.user_id);
    const all = ids.length ? ids : fallback ? [fallback] : [];
    return all.map((id) => nameOf.get(id) ?? "Membre");
  };
  const groups: { id: string | null; title: string; m?: PlanMilestone }[] = [
    ...milestones.map((m) => ({ id: m.id, title: m.title, m })),
    ...(tasks.some((t) => !t.milestone_id) ? [{ id: null, title: "Sans étape" }] : []),
  ];

  const saveMilestone = async () => {
    if (!editing?.title || editing.title.trim().length < 2) { toast.error("Donnez un titre à l'étape."); return; }
    const row = { title: editing.title.trim(), due_date: editing.due_date || null, description: editing.description?.trim() || null, deliverable: editing.deliverable?.trim() || null, status: editing.status ?? "PLANNED" };
    await run(editing.id ? supabase.from("project_milestones").update(row).eq("id", editing.id) : supabase.from("project_milestones").insert({ ...row, project_id: projectId, created_by: userId }), "Étape enregistrée.");
    setEditing(null);
  };
  const duplicateMilestone = async (m: PlanMilestone) => {
    const { data: copy, error } = await supabase.from("project_milestones").insert({ project_id: projectId, title: `${m.title} (copie)`, due_date: m.due_date, description: m.description, deliverable: m.deliverable, created_by: userId }).select("id").single();
    if (error || !copy) { toast.error(explainDbError(error ?? { message: "" })); return; }
    const own = tasks.filter((t) => t.milestone_id === m.id);
    if (own.length) await run(supabase.from("tasks").insert(own.map((t) => taskCopy(t, userId, { milestone_id: copy.id, title: t.title }))));
    toast.success(`Étape dupliquée avec ${own.length} tâche(s), remises « à faire ».`);
    refresh();
  };

  return (
    <section className="panel p-5" aria-labelledby="plan-title">
      <h2 id="plan-title" className="mb-3 font-display text-lg">Organisation du projet</h2>
      <Tabs defaultValue="etapes">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="etapes">Étapes</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="carte">Carte</TabsTrigger>
        </TabsList>

        <TabsContent value="etapes" className="space-y-4">
          {canManage ? <Button size="sm" variant="outline" onClick={() => setEditing({ status: "PLANNED" })}><Plus className="mr-1 size-4" /> Ajouter une étape</Button> : null}
          {groups.length === 0 ? <p className="text-sm text-muted-foreground">Aucune étape ni tâche pour l'instant.</p> : null}
          <ol className="space-y-3">
            {groups.map((g) => {
              const own = tasks.filter((t) => (g.id ? t.milestone_id === g.id : !t.milestone_id));
              const late = g.m && milestoneState(g.m) === "LATE";
              return (
                <li key={g.id ?? "none"} className="rounded-lg border border-border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{g.title}</p>
                      {g.m ? <p className="text-xs text-muted-foreground">{g.m.due_date ? `Date cible ${formatDate(g.m.due_date)}` : "Sans date cible"} · {MILESTONE_STATUS_LABEL[g.m.status] ?? g.m.status}{late ? " · en retard" : ""}</p> : null}
                      {g.m?.deliverable ? <p className="text-xs">Livrable : {g.m.deliverable}</p> : null}
                    </div>
                    {g.m && canManage ? (
                      <span className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" aria-label={`Modifier l'étape ${g.title}`} onClick={() => setEditing(g.m!)}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Dupliquer l'étape ${g.title}`} onClick={() => void duplicateMilestone(g.m!)}><Copy className="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Supprimer l'étape ${g.title}`} onClick={() => { if (confirm("Supprimer cette étape ? Ses tâches sont conservées, sans étape.")) void run(supabase.from("project_milestones").delete().eq("id", g.m!.id), "Étape supprimée."); }}><Trash2 className="size-4" /></Button>
                      </span>
                    ) : null}
                  </div>
                  {pm.get(g.id) ? <div className="mt-2"><Bar label="Avancement de l'étape" p={pm.get(g.id)!} /></div> : null}
                  <ul className="mt-2 space-y-1">
                    {own.map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => onOpenTask(t.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                          <span className="min-w-0 truncate">{t.title}</span>
                          <Badge variant="outline" className="shrink-0">{TASK_STATUS_LABEL[t.status] ?? t.status}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </TabsContent>

        <TabsContent value="categories" className="space-y-3">
          {canManage ? (
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (themeName.trim().length < 2) return; void run(supabase.from("project_themes").insert({ project_id: projectId, name: themeName.trim(), created_by: userId }), "Catégorie ajoutée."); setThemeName(""); }}>
              <div className="space-y-1"><Label htmlFor="theme-name" className="text-xs">Nouvelle catégorie</Label><Input id="theme-name" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Ex. Communication" className="w-56" /></div>
              <Button type="submit" size="sm" variant="outline">Ajouter</Button>
            </form>
          ) : null}
          {br.byTheme.length === 0 ? <p className="text-sm text-muted-foreground">Aucune catégorie : les tâches restent regroupées par étape.</p> : null}
          {br.byTheme.map((g) => (
            <div key={g.id ?? "none"} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Bar label={g.id ? themes.find((t) => t.id === g.id)?.name ?? "" : "Sans catégorie"} p={g} />
              {g.id && canManage ? <Button size="icon" variant="ghost" aria-label="Supprimer la catégorie" onClick={() => void run(supabase.from("project_themes").delete().eq("id", g.id!), "Catégorie supprimée.")}><Trash2 className="size-4" /></Button> : <span />}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="carte">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)} className="mb-3 justify-start">
            <ToggleGroupItem value="classique">Vue synthétique</ToggleGroupItem>
            <ToggleGroupItem value="detaillee">Vue détaillée</ToggleGroupItem>
          </ToggleGroup>
          <div className="overflow-x-auto">
            <ul className="space-y-3 border-l-2 border-primary/40 pl-4" aria-label="Carte du projet">
              {groups.map((g) => {
                const own = tasks.filter((t) => (g.id ? t.milestone_id === g.id : !t.milestone_id));
                const p = pm.get(g.id);
                return (
                  <li key={g.id ?? "none"}>
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-xs text-muted-foreground">{p?.percent ?? 0}% · {own.length} tâche(s){g.m?.due_date ? ` · ${formatDate(g.m.due_date)}` : ""}</span>
                    </div>
                    {mode === "detaillee" ? (
                      <ul className="mt-2 ml-4 space-y-1 border-l border-border pl-4">
                        {own.map((t) => (
                          <li key={t.id}>
                            <button type="button" onClick={() => onOpenTask(t.id)} className="text-left text-sm hover:underline">
                              {t.title}
                              <span className="text-xs text-muted-foreground"> · {TASK_STATUS_LABEL[t.status] ?? t.status} · {peopleOf(t.id, t.assigned_user_id).join(", ") || "personne"} · {t.deadline ? formatDate(t.deadline) : "sans date"}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Modifier l'étape" : "Nouvelle étape"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="ms-title">Titre</Label><Input id="ms-title" value={editing?.title ?? ""} onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ms-date">Date cible</Label><Input id="ms-date" type="date" value={editing?.due_date ?? ""} onChange={(e) => setEditing((s) => ({ ...s, due_date: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Statut</Label>
                <Select value={editing?.status ?? "PLANNED"} onValueChange={(v) => setEditing((s) => ({ ...s, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MILESTONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{MILESTONE_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label htmlFor="ms-deliv">Livrable attendu</Label><Input id="ms-deliv" value={editing?.deliverable ?? ""} onChange={(e) => setEditing((s) => ({ ...s, deliverable: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="ms-desc">Description</Label><Textarea id="ms-desc" value={editing?.description ?? ""} onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => void saveMilestone()}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
