import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CommunicationCard } from "@/components/CommunicationCard";
import {
  COMMUNICATION_COLUMNS,
  CommunicationEditor,
  useCommunicationPeople,
  type Communication,
} from "@/components/CommunicationEditor";

/** Communications du projet : visibles par le Bureau et l'équipe du projet (RLS can_work_on_communication). */
export function ProjectCommunications({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Communication | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["project-communications", projectId],
    queryFn: async () =>
      ((await supabase.from("bureau_communications").select(COMMUNICATION_COLUMNS).eq("project_id", projectId).order("updated_at", { ascending: false })).data ??
        []) as Communication[],
  });
  const people = useCommunicationPeople(projectId);
  const { data: tasks = [] } = useQuery({
    queryKey: ["communication-tasks", projectId],
    queryFn: async () => (await supabase.from("tasks").select("id,title").eq("project_id", projectId).order("title")).data ?? [],
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["project-communications", projectId] });
    void qc.invalidateQueries({ queryKey: ["bureau-communications"] });
    void qc.invalidateQueries({ queryKey: ["association-updates"] });
  };
  const nameOf = (id: string | null) => (people.data ?? []).find((p) => p.id === id)?.name;

  return (
    <section className="panel space-y-3 p-5" aria-labelledby="project-comms-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="project-comms-title" className="flex items-center gap-2 text-lg">
          <Megaphone className="size-4 text-primary" aria-hidden /> Communication du projet
        </h2>
        <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" aria-hidden /> Préparer
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Préparée avec le Bureau et l'équipe du projet, validée par le Bureau, puis publiée dans « Actualités ».</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune communication en préparation.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((c) => (
            <CommunicationCard
              key={c.id}
              c={c}
              ownerName={nameOf(c.owner_id)}
              taskTitle={tasks.find((t) => t.id === c.task_id)?.title}
              onEdit={(x) => { setEditing(x); setOpen(true); }}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}
      <CommunicationEditor open={open} onOpenChange={setOpen} editing={editing} fixedProjectId={projectId} onSaved={refresh} />
    </section>
  );
}
