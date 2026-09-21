import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BureauOnly } from "@/components/BureauOnly";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateTeamAdvice, type Recommendation } from "@/lib/team-advisor.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/advisor")({
  head: () => ({
    meta: [
      { title: "Conseiller d'équipe — La Voix du Chien" },
      {
        name: "description",
        content:
          "Décrivez un besoin ou un blocage : l'assistant propose des recommandations priorisées pour améliorer le travail d'équipe.",
      },
      { property: "og:title", content: "Conseiller d'équipe — La Voix du Chien" },
      {
        property: "og:description",
        content: "Recommandations priorisées pour débloquer le travail d'équipe de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvisorPage,
});

const PRIORITY_STYLE: Record<string, string> = {
  HAUTE: "bg-primary text-primary-foreground",
  MOYENNE: "bg-secondary text-secondary-foreground",
  BASSE: "bg-muted text-muted-foreground",
};

function AdvisorPage() {
  const { user, isBureau, loading } = useAuth();
  const queryClient = useQueryClient();
  const [situation, setSituation] = useState("");
  const advise = useServerFn(generateTeamAdvice);

  const { data: history = [] } = useQuery({
    queryKey: ["team-advices"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_advices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      const text = situation.trim();
      if (text.length < 20) {
        throw new Error("Décrivez la situation en quelques phrases (20 caractères minimum).");
      }
      const advice = await advise({ data: { situation: text } });
      const { error } = await supabase.from("team_advices").insert({
        created_by: user?.id ?? null,
        situation: text,
        summary: advice.summary,
        recommendations: advice.recommendations as never,
      });
      if (error) throw error;
      return advice;
    },
    onSuccess: () => {
      setSituation("");
      toast.success("Recommandations prêtes.");
      void queryClient.invalidateQueries({ queryKey: ["team-advices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_advices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["team-advices"] }),
  });

  if (!loading && !isBureau) return <BureauOnly title="Conseiller d'équipe" />;

  return (
    <AppShell
      title="Conseiller d'équipe"
      subtitle="Décrivez un besoin ou un blocage, recevez des pistes classées par priorité"
    >
      <div className="space-y-6">
        <section className="panel space-y-3 p-5">
          <label htmlFor="situation" className="text-sm font-medium">
            Votre situation
          </label>
          <Textarea
            id="situation"
            rows={5}
            placeholder="Exemple : les bénévoles ne répondent plus sur le projet collectes, les tâches restent bloquées et le Bureau relance à la main…"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              L'analyse peut prendre jusqu'à une minute.
            </p>
            <Button onClick={() => run.mutate()} disabled={run.isPending} className="gap-2">
              <Sparkles className="size-4" />
              {run.isPending ? "Analyse en cours…" : "Obtenir des recommandations"}
            </Button>
          </div>
        </section>

        {run.data ? (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">{run.data.summary}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {run.data.recommendations.map((reco, index) => (
                <RecoCard key={`${reco.title}-${index}`} reco={reco} rank={index + 1} />
              ))}
            </div>
          </section>
        ) : null}

        {history.length ? (
          <section className="space-y-3">
            <h2 className="text-lg">Analyses précédentes</h2>
            {history.map((row) => (
              <details key={row.id} className="panel p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {new Date(row.created_at).toLocaleString("fr-FR", { dateStyle: "long" })} —{" "}
                  {row.situation.slice(0, 80)}…
                </summary>
                <div className="mt-3 space-y-3">
                  {row.summary ? (
                    <p className="text-sm text-muted-foreground">{row.summary}</p>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {((row.recommendations ?? []) as unknown as Recommendation[]).map(
                      (reco, index) => (
                        <RecoCard key={`${row.id}-${index}`} reco={reco} rank={index + 1} />
                      ),
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 className="size-4" /> Supprimer
                  </Button>
                </div>
              </details>
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function RecoCard({ reco, rank }: { reco: Recommendation; rank: number }) {
  return (
    <article className="panel space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium">
          {rank}. {reco.title}
        </h3>
        <Badge className={PRIORITY_STYLE[reco.priority] ?? ""}>{reco.priority}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{reco.why}</p>
      <p className="text-sm">
        <span className="font-medium">Première étape : </span>
        {reco.first_step}
      </p>
      <p className="text-xs text-muted-foreground">À confier à : {reco.owner_hint}</p>
    </article>
  );
}
