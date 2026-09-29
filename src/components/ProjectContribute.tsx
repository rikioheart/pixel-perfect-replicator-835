import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpWizard } from "@/components/HelpWizard";
import { CONTRIBUTION_STATUS_LABEL, CONTRIBUTION_TYPES, CONTRIBUTION_TYPE_LABEL } from "@/lib/contributions";

type ProjectStory = {
  id: string;
  why: string | null;
  for_whom: string | null;
  objective: string | null;
  done_steps: string | null;
  next_steps: string | null;
  current_needs: string | null;
  how_to_contribute: string | null;
};

export function ProjectStorySections({ project }: { project: ProjectStory }) {
  const blocks = [
    ["Pourquoi ce projet existe", project.why],
    ["Pour qui", project.for_whom],
    ["Objectif", project.objective],
    ["Étapes réalisées", project.done_steps],
    ["Prochaines étapes", project.next_steps],
    ["Besoins actuels", project.current_needs],
    ["Comment contribuer", project.how_to_contribute],
  ].filter(([, v]) => v) as [string, string][];
  if (blocks.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {blocks.map(([t, v]) => (
        <section key={t} className="panel p-4 text-sm">
          <h2 className="font-display text-base">{t}</h2>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{v}</p>
        </section>
      ))}
    </div>
  );
}

export function ProjectContribute({ projectId }: { projectId: string }) {
  const [preset, setPreset] = useState<string | null>(null);
  const { data: contributions = [] } = useQuery({
    queryKey: ["contributions", projectId],
    queryFn: async () =>
      (await supabase.from("contributions").select("id,title,contribution_type,status,user_id").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-5" aria-labelledby="contrib-q">
        <h2 id="contrib-q" className="font-display text-lg">Comment aimeriez-vous contribuer ?</h2>
        <div className="flex flex-wrap gap-2">
          {CONTRIBUTION_TYPES.map(([k, l]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setPreset(k)}>{l}</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Une intention suffit : le Bureau en discute avec vous avant tout engagement.</p>
      </section>
      {contributions.length > 0 ? (
        <section className="panel space-y-2 p-5">
          <h2 className="font-display text-lg">Contributions</h2>
          <ul className="space-y-2 text-sm">
            {contributions.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.title}</span>
                <span className="flex gap-1">
                  <Badge variant="outline">{CONTRIBUTION_TYPE_LABEL[c.contribution_type]}</Badge>
                  <Badge variant="secondary">{CONTRIBUTION_STATUS_LABEL[c.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <HelpWizard open={preset !== null} onOpenChange={(o) => !o && setPreset(null)} projectId={projectId} presetType={preset ?? ""} />
    </div>
  );
}
