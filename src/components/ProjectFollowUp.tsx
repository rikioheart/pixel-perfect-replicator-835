import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/domain";
import { UPDATE_KINDS, UPDATE_KIND_LABEL } from "@/lib/contributions";
import { explainDbError } from "@/lib/task-lifecycle";
import { milestoneState, sortMilestones, type Milestone } from "@/lib/project-followup";

type Project = {
  id: string;
  done_steps: string | null;
  next_steps: string | null;
  rex_successes: string | null;
  rex_improvements: string | null;
  rex_advice: string | null;
};

const IMG = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;

/** Suivi : jalons (étapes texte + liste datée), journal du projet, photos, retour d'expérience. */
export function ProjectFollowUp({
  project,
  canManage,
  onProjectPatch,
}: {
  project: Project;
  canManage: boolean;
  onProjectPatch: (patch: Record<string, string | null>) => Promise<void>;
}) {
  return (
    <section className="panel p-5" aria-labelledby="followup-title">
      <h2 id="followup-title" className="mb-3 font-display text-lg">Suivi du projet</h2>
      <Tabs defaultValue="jalons">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="jalons">Jalons</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="rex">Retour d'expérience</TabsTrigger>
        </TabsList>
        <TabsContent value="jalons"><Milestones project={project} canManage={canManage} /></TabsContent>
        <TabsContent value="journal"><Journal projectId={project.id} /></TabsContent>
        <TabsContent value="photos"><Photos projectId={project.id} canManage={canManage} /></TabsContent>
        <TabsContent value="rex"><Rex project={project} canManage={canManage} onPatch={onProjectPatch} /></TabsContent>
      </Tabs>
    </section>
  );
}

function Milestones({ project, canManage }: { project: Project; canManage: boolean }) {
  const qc = useQueryClient();
  const key = ["project-milestones", project.id];
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const { data: list = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((await supabase.from("project_milestones").select("id,title,due_date,done_at").eq("project_id", project.id)).data ?? []) as Milestone[],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const run = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    const { error } = await p;
    if (error) toast.error(explainDbError(error));
    else void refresh();
  };
  const add = async () => {
    if (title.trim().length < 2) return toast.error("Donnez un intitulé à l'étape.");
    const { data: u } = await supabase.auth.getUser();
    await run(supabase.from("project_milestones").insert({ project_id: project.id, title: title.trim(), due_date: due || null, created_by: u.user?.id ?? null }));
    setTitle("");
    setDue("");
  };
  const sorted = sortMilestones(list);
  const icon = { DONE: CheckCircle2, LATE: AlertTriangle, UPCOMING: Circle } as const;
  const label = { DONE: "Atteinte", LATE: "En retard", UPCOMING: "À venir" } as const;

  return (
    <div className="space-y-4 text-sm">
      {project.done_steps || project.next_steps ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {project.done_steps ? (
            <div className="rounded-md border border-border p-3">
              <p className="mb-1 flex items-center gap-1 font-medium"><CheckCircle2 className="size-4 text-primary" aria-hidden /> Étapes réalisées</p>
              <p className="whitespace-pre-line text-muted-foreground">{project.done_steps}</p>
            </div>
          ) : null}
          {project.next_steps ? (
            <div className="rounded-md border border-border p-3">
              <p className="mb-1 flex items-center gap-1 font-medium"><Circle className="size-4" aria-hidden /> Prochaines étapes</p>
              <p className="whitespace-pre-line text-muted-foreground">{project.next_steps}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-muted-foreground">Aucune étape datée pour l'instant.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {sorted.map((m) => {
            const s = milestoneState(m);
            const Icon = icon[s];
            return (
              <li key={m.id} className="relative">
                <Icon className={`absolute -left-[1.85rem] top-0.5 size-4 bg-card ${s === "LATE" ? "text-destructive" : s === "DONE" ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={s === "DONE" ? "text-muted-foreground line-through" : ""}>{m.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{m.due_date ? formatDate(m.due_date) : "Sans date"}</span>
                    <Badge variant={s === "LATE" ? "destructive" : "outline"}>{label[s]}</Badge>
                    {canManage ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => run(supabase.from("project_milestones").update({ done_at: m.done_at ? null : new Date().toISOString() }).eq("id", m.id))}>
                          {m.done_at ? "Rouvrir" : "Marquer atteinte"}
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={`Supprimer l'étape ${m.title}`} onClick={() => run(supabase.from("project_milestones").delete().eq("id", m.id))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canManage ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-48 flex-1"><Label htmlFor="ms-t" className="text-xs">Nouvelle étape</Label><Input id="ms-t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label htmlFor="ms-d" className="text-xs">Date (facultatif)</Label><Input id="ms-d" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <Button onClick={add}>Ajouter</Button>
        </div>
      ) : null}
    </div>
  );
}

function Journal({ projectId }: { projectId: string }) {
  const { user, isBureau, isPro } = useAuth();
  const qc = useQueryClient();
  const canPost = isBureau || isPro;
  const [form, setForm] = useState({ kind: "PROJET", title: "", body: "" });
  const { data: rows = [] } = useQuery({
    queryKey: ["project-journal", projectId],
    queryFn: async () =>
      (await supabase.from("association_updates").select("id,kind,title,body,created_at").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });
  const post = async () => {
    if (form.title.trim().length < 3) return toast.error("Donnez un titre.");
    const { error } = await supabase.from("association_updates").insert({ project_id: projectId, kind: form.kind, title: form.title.trim(), body: form.body.trim() || null, is_public: false, created_by: user!.id });
    if (error) return toast.error(explainDbError(error));
    toast.success("Avancée ajoutée au journal.");
    setForm({ kind: "PROJET", title: "", body: "" });
    void qc.invalidateQueries({ queryKey: ["project-journal", projectId] });
    void qc.invalidateQueries({ queryKey: ["association-updates"] });
  };
  return (
    <div className="space-y-4 text-sm">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Le journal de ce projet est encore vide.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-border pb-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{UPDATE_KIND_LABEL[r.kind] ?? r.kind}</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
              </div>
              <p className="mt-1 font-medium">{r.title}</p>
              {r.body ? <p className="whitespace-pre-line text-muted-foreground">{r.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {canPost ? (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <div>
              <Label htmlFor="pj-k" className="text-xs">Type</Label>
              <select id="pj-k" className="h-10 w-full rounded-md border border-input bg-background px-2" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {UPDATE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div><Label htmlFor="pj-t" className="text-xs">Titre</Label><Input id="pj-t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          </div>
          <div><Label htmlFor="pj-b" className="text-xs">Détails (facultatif)</Label><Textarea id="pj-b" rows={2} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Visible par les membres dans « Nos avancées », jamais publiée hors de la plateforme.</p>
          <Button onClick={post}>Ajouter au journal</Button>
        </div>
      ) : null}
    </div>
  );
}

function Photos({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const { data: docs = [] } = useQuery({
    queryKey: ["project-photos", projectId],
    queryFn: async () =>
      (await supabase.from("documents").select("id,title,url,category,sensitivity").eq("context_type", "PROJECT").eq("context_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });
  const photos = docs.filter((d) => d.category === "PHOTO" || IMG.test(d.url));
  const add = async () => {
    if (!/^https:\/\//i.test(url.trim())) return toast.error("Collez un lien https vers la photo (Drive, album…).");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("documents").insert({
      title: title.trim() || "Photo du projet", url: url.trim(), category: "PHOTO", context_type: "PROJECT", context_id: projectId,
      sensitivity: "INTERNE", visibility: "MEMBERS", uploaded_by: u.user?.id ?? null,
    } as never);
    if (error) return toast.error(explainDbError(error));
    setTitle(""); setUrl("");
    void qc.invalidateQueries({ queryKey: ["project-photos", projectId] });
  };
  return (
    <div className="space-y-4 text-sm">
      {photos.length === 0 ? (
        <p className="text-muted-foreground">Aucune photo partagée pour ce projet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-md border border-border">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                {IMG.test(p.url) ? (
                  <img src={p.url} alt={p.title} loading="lazy" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">Ouvrir l'album</div>
                )}
                <p className="truncate p-2 text-xs">{p.title}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-40 flex-1"><Label htmlFor="ph-t" className="text-xs">Légende</Label><Input id="ph-t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="min-w-56 flex-[2]"><Label htmlFor="ph-u" className="text-xs">Lien de la photo ou de l'album</Label><Input id="ph-u" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <Button onClick={add}>Ajouter</Button>
        </div>
      ) : null}
    </div>
  );
}

function Rex({ project, canManage, onPatch }: { project: Project; canManage: boolean; onPatch: (p: Record<string, string | null>) => Promise<void> }) {
  const fields = [
    ["rex_successes", "Ce qui a bien fonctionné"],
    ["rex_improvements", "Ce que nous ferions autrement"],
    ["rex_advice", "Conseils pour la prochaine fois"],
  ] as const;
  if (!canManage && fields.every(([k]) => !project[k])) {
    return <p className="text-sm text-muted-foreground">Le bilan sera partagé par l'équipe du projet.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {fields.map(([k, l]) => (
        <div key={k}>
          <Label htmlFor={`rex-${k}`} className="text-xs">{l}</Label>
          {canManage ? (
            <Textarea id={`rex-${k}`} rows={4} defaultValue={project[k] ?? ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (project[k] ?? "")) void onPatch({ [k]: v || null }); }} />
          ) : (
            <p id={`rex-${k}`} className="whitespace-pre-line text-sm text-muted-foreground">{project[k] || "—"}</p>
          )}
        </div>
      ))}
    </div>
  );
}
