import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dog, Lock, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useProOptions } from "@/lib/pro-card";

export const Route = createFileRoute("/_authenticated/espace-pro/chiens")({
  head: () => ({
    meta: [
      { title: "Chiens accompagnés — La Voix du Chien" },
      { name: "description", content: "Les chiens dont les propriétaires vous ont ouvert un accès, selon les rubriques partagées." },
      { property: "og:title", content: "Chiens accompagnés — La Voix du Chien" },
      { property: "og:description", content: "Suivi des chiens accompagnés par le professionnel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProDogsPage,
});

type ProDog = {
  id: string;
  is_referent: boolean;
  operational: boolean;
  can_share_followup: boolean;
  expires_at: string | null;
  perms: Record<"identity" | "info" | "goals" | "activities" | "observations", boolean>;
  identity: { name: string; breed: string | null; sex: string | null; birth_date: string | null; photo_url: string | null } | null;
  info: { character: string | null; needs: string | null; useful_information: string | null } | null;
  goals: { id: string; title: string; status: string }[] | null;
  activities: { title: string; date: string | null }[] | null;
  observations: { id: string; body: string; created_at: string; mine: boolean }[] | null;
};

function Hidden({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3" aria-hidden /> {label} : non partagé par le propriétaire
    </p>
  );
}

const SECTIONS = [
  ["identity", "Identité"],
  ["info", "Informations"],
  ["goals", "Objectifs"],
  ["activities", "Activités"],
  ["observations", "Observations et suivis"],
] as const;

function ReferentShare({ dog }: { dog: ProDog }) {
  const { data: pros = [] } = useProOptions();
  const qc = useQueryClient();
  const [pro, setPro] = useState("");
  const [context, setContext] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({ identity: true });
  const { data: given = [] } = useQuery({
    queryKey: ["given-access", dog.id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("dog_professional_access").select("id, professional_id, context, revoked")
        .eq("dog_id", dog.id).eq("granted_by", u.user!.id).eq("revoked", false);
      return data ?? [];
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["given-access", dog.id] });
  const share = useMutation({
    mutationFn: async () => {
      if (!pro || context.trim().length < 3) throw new Error("Choisissez un professionnel et un contexte.");
      const { error } = await supabase.rpc("share_dog_access", {
        _dog_id: dog.id, _professional_id: pro, _identity: !!sel.identity, _info: !!sel.info, _goals: !!sel.goals,
        _activities: !!sel.activities, _observations: !!sel.observations, _context: context.trim(),
        _expires_at: null as unknown as string,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Partage effectué."); setContext(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_dog_access", { _access_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Partage retiré."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const allowed = (k: string) => dog.perms[k as keyof ProDog["perms"]] && ((k !== "goals" && k !== "observations") || dog.can_share_followup);
  return (
    <details className="rounded-md border border-border p-2">
      <summary className="cursor-pointer font-medium">Partager avec un autre professionnel</summary>
      <div className="mt-2 space-y-2">
        {given.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-2 text-xs">
            <span>{pros.find((p) => p.id === g.professional_id)?.name ?? "Professionnel"} — {g.context}</span>
            <Button size="sm" variant="ghost" onClick={() => revoke.mutate(g.id)}>Retirer</Button>
          </div>
        ))}
        <select aria-label="Professionnel destinataire" className="h-10 w-full rounded-md border border-input bg-background px-2" value={pro} onChange={(e) => setPro(e.target.value)}>
          <option value="">Choisir…</option>
          {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <fieldset className="grid grid-cols-2 gap-1">
          <legend className="text-xs text-muted-foreground">Rubriques (jamais plus que les vôtres)</legend>
          {SECTIONS.map(([k, l]) => (
            <label key={k} className="flex min-h-9 items-center gap-2">
              <input type="checkbox" disabled={!allowed(k)} checked={!!sel[k] && allowed(k)} onChange={(e) => setSel({ ...sel, [k]: e.target.checked })} /> {l}
            </label>
          ))}
        </fieldset>
        {!dog.can_share_followup ? <p className="text-xs text-muted-foreground">Le propriétaire n'a pas autorisé le partage du suivi.</p> : null}
        <Input aria-label="Contexte du partage" placeholder="Contexte (obligatoire)" value={context} onChange={(e) => setContext(e.target.value)} />
        <Button size="sm" onClick={() => share.mutate()} disabled={share.isPending}>Partager</Button>
      </div>
    </details>
  );
}

function DogCard({ dog }: { dog: ProDog }) {
  const queryClient = useQueryClient();
  const [obs, setObs] = useState("");
  const [goal, setGoal] = useState("");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["pro-dogs"] });

  const addObs = useMutation({
    mutationFn: async () => {
      if (obs.trim().length < 3) throw new Error("Observation trop courte.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("dog_observations").insert({ dog_id: dog.id, body: obs.trim(), author_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => { setObs(""); toast.success("Observation ajoutée."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addGoal = useMutation({
    mutationFn: async () => {
      if (goal.trim().length < 3) throw new Error("Objectif trop court.");
      const { error } = await supabase.from("dog_goals").insert({ dog_id: dog.id, title: goal.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setGoal(""); toast.success("Objectif ajouté."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="panel space-y-3 p-4 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {dog.identity?.photo_url ? (
            <img src={dog.identity.photo_url} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-muted" aria-hidden><Dog className="size-5" /></span>
          )}
          <div>
            <h2 className="font-display text-lg">{dog.identity?.name ?? "Chien (identité non partagée)"}</h2>
            {dog.identity ? (
              <p className="text-xs text-muted-foreground">{[dog.identity.breed, dog.identity.sex].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {dog.is_referent ? <Badge className="gap-1"><Star className="size-3" aria-hidden /> Référent</Badge> : null}
          {dog.operational && !dog.is_referent ? <Badge variant="outline">Activité / terrain</Badge> : null}
          {dog.expires_at ? <span className="text-xs text-muted-foreground">Accès jusqu'au {new Date(dog.expires_at).toLocaleDateString("fr-FR")}</span> : null}
        </div>
      </header>

      {dog.info ? (
        <div className="space-y-1">
          <h3 className="font-medium">Informations partagées</h3>
          {dog.info.character ? <p><span className="text-muted-foreground">Caractère :</span> {dog.info.character}</p> : null}
          {dog.info.needs ? <p><span className="text-muted-foreground">Besoins :</span> {dog.info.needs}</p> : null}
          {dog.info.useful_information ? <p><span className="text-muted-foreground">À savoir :</span> {dog.info.useful_information}</p> : null}
        </div>
      ) : <Hidden label="Informations" />}

      {dog.goals ? (
        <div className="space-y-1">
          <h3 className="font-medium">Objectifs</h3>
          {dog.goals.length === 0 ? <p className="text-muted-foreground">Aucun objectif.</p> : (
            <ul className="list-disc pl-5">{dog.goals.map((g) => <li key={g.id}>{g.title} <Badge variant="outline">{g.status.replace("_", " ")}</Badge></li>)}</ul>
          )}
          <div className="flex gap-2">
            <Input aria-label="Nouvel objectif" placeholder="Nouvel objectif" value={goal} onChange={(e) => setGoal(e.target.value)} />
            <Button size="sm" onClick={() => addGoal.mutate()} disabled={addGoal.isPending}>Ajouter</Button>
          </div>
        </div>
      ) : <Hidden label="Objectifs" />}

      {dog.activities ? (
        <div className="space-y-1">
          <h3 className="font-medium">Activités</h3>
          {dog.activities.length === 0 ? <p className="text-muted-foreground">Aucune activité.</p> : (
            <ul className="list-disc pl-5">{dog.activities.map((a, i) => <li key={i}>{a.title}{a.date ? ` — ${new Date(a.date).toLocaleDateString("fr-FR")}` : ""}</li>)}</ul>
          )}
        </div>
      ) : <Hidden label="Activités" />}

      {dog.observations ? (
        <div className="space-y-2">
          <h3 className="font-medium">Observations</h3>
          {dog.observations.map((o) => (
            <p key={o.id} className="rounded-md bg-muted/50 p-2">
              <span className="block text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-FR")}{o.mine ? " · vous" : ""}</span>
              {o.body}
            </p>
          ))}
          <Textarea aria-label="Nouvelle observation" placeholder="Nouvelle observation" value={obs} onChange={(e) => setObs(e.target.value)} />
          <Button size="sm" onClick={() => addObs.mutate()} disabled={addObs.isPending}>Ajouter l'observation</Button>
        </div>
      ) : <Hidden label="Observations" />}

      {dog.is_referent ? <ReferentShare dog={dog} /> : null}
    </article>
  );
}

function ProDogsPage() {
  const { data: dogs = [], isLoading } = useQuery({
    queryKey: ["pro-dogs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pro_dogs");
      if (error) throw error;
      return (data ?? []) as unknown as ProDog[];
    },
  });
  return (
    <AppShell title="Chiens accompagnés" subtitle="Seuls les chiens avec un accès partagé actif apparaissent ici">
      {isLoading ? <LoadingState rows={3} /> : dogs.length === 0 ? (
        <EmptyState title="Aucun chien partagé" message="Quand un propriétaire vous ouvre l'accès à la fiche de son chien, elle apparaît ici avec les rubriques qu'il a choisies." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{dogs.map((d) => <DogCard key={d.id} dog={d} />)}</div>
      )}
    </AppShell>
  );
}
