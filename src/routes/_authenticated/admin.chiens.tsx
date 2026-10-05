import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BureauOnly } from "@/components/BureauOnly";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/chiens")({
  head: () => ({
    meta: [
      { title: "Chiens de l'association — Bureau" },
      { name: "description", content: "Vue Bureau de tous les chiens : informations principales et dossiers selon les choix des propriétaires." },
      { property: "og:title", content: "Chiens de l'association — Bureau" },
      { property: "og:description", content: "Vue Bureau des chiens de l'association." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type BDog = {
  id: string; name: string; breed: string | null; sex: string | null; household: string | null; owner: string | null;
  full: boolean; private_sections: string[];
  info: { character: string | null; needs: string | null; useful_information: string | null } | null;
  goals: { title: string; status: string }[] | null;
  observations: { body: string; created_at: string }[] | null;
};

function Page() {
  const { isBureau, rolesReady, user } = useAuth();
  const qc = useQueryClient();
  const { data: hidden } = useQuery({
    queryKey: ["hide-dogs", user?.id], enabled: Boolean(user && isBureau),
    queryFn: async () => (await supabase.from("profiles").select("hide_sensitive_dogs").eq("id", user!.id).maybeSingle()).data?.hide_sensitive_dogs ?? false,
  });
  const { data: dogs = [], isLoading } = useQuery({
    queryKey: ["bureau-dogs", hidden], enabled: isBureau,
    queryFn: async () => { const { data, error } = await supabase.rpc("bureau_dogs"); if (error) throw error; return (data ?? []) as unknown as BDog[]; },
  });
  const toggle = useMutation({
    mutationFn: async (v: boolean) => { const { error } = await supabase.from("profiles").update({ hide_sensitive_dogs: v }).eq("id", user!.id); if (error) throw error; },
    onSuccess: () => { toast.success("Visibilité mise à jour."); void qc.invalidateQueries({ queryKey: ["hide-dogs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (rolesReady && !isBureau) return <BureauOnly title="Chiens de l'association" />;
  return (
    <AppShell title="Chiens de l'association" subtitle="Informations principales pour tous ; dossiers selon les choix des propriétaires">
      <label className="panel mb-4 flex min-h-12 items-center gap-2 p-3 text-sm">
        <input type="checkbox" checked={Boolean(hidden)} onChange={(e) => toggle.mutate(e.target.checked)} />
        Masquer pour moi les dossiers détaillés (je ne vois que les informations principales)
      </label>
      {isLoading ? <LoadingState rows={3} /> : dogs.length === 0 ? <EmptyState title="Aucun chien" message="Aucun chien enregistré pour le moment." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {dogs.map((d) => (
            <article key={d.id} className="panel space-y-2 p-4 text-sm">
              <h2 className="font-display text-lg">{d.name}</h2>
              <p className="text-xs text-muted-foreground">{[d.breed, d.sex, d.household ?? d.owner].filter(Boolean).join(" · ")}</p>
              {d.full ? (
                <>
                  {d.info ? <p>{[d.info.character, d.info.needs, d.info.useful_information].filter(Boolean).join(" — ") || "Pas d'informations."}</p> : <Priv label="Informations" />}
                  {d.goals ? <p className="text-xs">Objectifs : {d.goals.map((g) => g.title).join(", ") || "aucun"}</p> : <Priv label="Objectifs" />}
                  {d.observations ? <p className="text-xs">{d.observations.length} observation(s)</p> : <Priv label="Observations" />}
                </>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Priv({ label }: { label: string }) {
  return <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" aria-hidden /> {label} : privé (choix du propriétaire)</p>;
}
