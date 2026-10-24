import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpWizard } from "@/components/HelpWizard";
import { CONTRIBUTION_STATUS_LABEL, CONTRIBUTION_TYPES, CONTRIBUTION_TYPE_LABEL } from "@/lib/contributions";
import { explainDbError } from "@/lib/task-lifecycle";

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

const ACTIVE_OFFER = ["PROPOSED", "DISCUSSION", "ACCEPTED", "IN_PROGRESS"];

/**
 * Proposer son aide sur un projet. Une proposition n'est jamais une tâche ni une
 * auto-affectation : le coordinateur ou le Bureau l'accepte, puis confie les tâches.
 */
export function ProjectContribute({ projectId, canModerate = false }: { projectId: string; canModerate?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<string | null>(null);
  const { data: contributions = [] } = useQuery({
    queryKey: ["contributions", projectId],
    queryFn: async () =>
      (
        await supabase
          .from("contributions")
          .select("id,title,description,contribution_type,status,user_id,estimated_time")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const myOffer = contributions.find((c) => c.user_id === user?.id && ACTIVE_OFFER.includes(c.status));

  const decide = async (id: string, status: "ACCEPTED" | "CANCELLED" | "DISCUSSION") => {
    const { data, error } = await supabase.from("contributions").update({ status }).eq("id", id).select("id");
    if (error) {
      toast.error(explainDbError(error));
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Action refusée : réservée au coordinateur du projet et au Bureau.");
      return;
    }
    toast.success(
      status === "ACCEPTED"
        ? "Proposition acceptée : la personne rejoint l'équipe. Confiez-lui une tâche quand vous êtes prêts."
        : status === "DISCUSSION"
          ? "Proposition passée en discussion."
          : "Proposition déclinée.",
    );
    void qc.invalidateQueries({ queryKey: ["contributions"] });
    void qc.invalidateQueries({ queryKey: ["project-members", projectId] });
  };

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-5" aria-labelledby="contrib-q">
        <h2 id="contrib-q" className="font-display text-lg">Comment aimeriez-vous contribuer ?</h2>
        {myOffer ? (
          <p className="text-sm text-muted-foreground" role="status">
            Vous avez déjà proposé votre aide sur ce projet ({CONTRIBUTION_STATUS_LABEL[myOffer.status]?.toLowerCase()}).
            Le coordinateur revient vers vous ; vous pouvez en proposer une autre si besoin.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {CONTRIBUTION_TYPES.map(([k, l]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setPreset(k)}>{l}</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Une intention suffit : le coordinateur du projet ou le Bureau en discute avec vous avant tout engagement.
        </p>
      </section>
      {contributions.length > 0 ? (
        <section className="panel space-y-2 p-5">
          <h2 className="font-display text-lg">Propositions d'aide</h2>
          <ul className="space-y-3 text-sm">
            {contributions.map((c) => (
              <li key={c.id} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{c.title}</span>
                  <span className="flex gap-1">
                    <Badge variant="outline">{CONTRIBUTION_TYPE_LABEL[c.contribution_type]}</Badge>
                    <Badge variant="secondary">{CONTRIBUTION_STATUS_LABEL[c.status]}</Badge>
                  </span>
                </div>
                {canModerate && c.description ? (
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{c.description}</p>
                ) : null}
                {canModerate && (c.status === "PROPOSED" || c.status === "DISCUSSION") && c.user_id !== user?.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => decide(c.id, "ACCEPTED")}>Accepter</Button>
                    {c.status === "PROPOSED" ? (
                      <Button size="sm" variant="outline" onClick={() => decide(c.id, "DISCUSSION")}>En discuter</Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => decide(c.id, "CANCELLED")}>Décliner</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <HelpWizard open={preset !== null} onOpenChange={(o) => !o && setPreset(null)} projectId={projectId} presetType={preset ?? ""} />
    </div>
  );
}
