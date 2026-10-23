import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberPicker } from "@/components/MemberPicker";
import { formatParisDateTime } from "@/lib/places";
import { decisionTaskMarker } from "@/lib/governance";

type Record = { id: string; title: string; decisions: string | null; follow_up: string | null; meeting_at: string | null; meeting_date: string };

/** Crée une tâche dans le système existant à partir d'une décision du registre (pas de seconde gestion de tâches). */
export function DecisionToTask({ record }: { record: Record }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const marker = decisionTaskMarker(record.id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignee, setAssignee] = useState<string[]>([]);

  const { data: linked = [] } = useQuery({
    queryKey: ["decision-tasks", record.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("id,title,status").ilike("description", `%${marker}%`);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-light"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,title").order("title").limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const start = () => {
    const firstLine = (record.decisions ?? "").split("\n").map((s) => s.trim()).find(Boolean) ?? record.title;
    setTitle(firstLine.slice(0, 120));
    setDescription([record.decisions, record.follow_up ? `Suivi : ${record.follow_up}` : ""].filter(Boolean).join("\n\n"));
    setDeadline(""); setProjectId(""); setAssignee([]);
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 3) throw new Error("Donnez un titre à la tâche.");
      const source = `Issue de : ${record.title} (${formatParisDateTime(record.meeting_at ?? record.meeting_date)}) ${marker}`;
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: `${description.trim()}\n\n${source}`.trim(),
        deadline: deadline || null,
        project_id: projectId || null,
        assigned_user_id: assignee[0] ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tâche créée. Retrouvez-la dans Tâches.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["decision-tasks", record.id] });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Vous n'avez pas le droit de créer cette tâche." : e.message),
  });

  if (!record.decisions?.trim()) return null;
  return (
    <>
      {linked.length > 0 ? (
        <p className="text-xs text-muted-foreground">Tâche liée : {linked.map((t) => `${t.title} (${t.status})`).join(", ")}</p>
      ) : null}
      <Button size="sm" variant="outline" onClick={start}><ListChecks className="mr-1 size-3.5" aria-hidden />Créer une tâche liée</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer une tâche liée</DialogTitle>
            <DialogDescription>Vérifiez et ajustez avant de confirmer. La réunion d'origine restera indiquée dans la tâche.</DialogDescription>
          </DialogHeader>
          {linked.length > 0 ? <p className="rounded-md bg-muted p-2 text-sm">Une tâche existe déjà pour cette décision. Créez-en une autre seulement si le travail est différent.</p> : null}
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="dt-title">Titre</Label><Input id="dt-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dt-desc">Description</Label><Textarea id="dt-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="dt-deadline">Échéance</Label><Input id="dt-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="dt-project">Projet</Label>
                <select id="dt-project" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Aucun projet</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select></div>
            </div>
            <MemberPicker label="Personne responsable (facultatif)" selected={assignee} onChange={setAssignee} single />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Créer la tâche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
