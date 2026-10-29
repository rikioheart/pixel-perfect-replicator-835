import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Home, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BureauOnly } from "@/components/BureauOnly";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { INDICATOR_FAMILY_LABEL } from "@/lib/dog-timeline";
import { ageFrom, membersInSeveralHouseholds, personLabel, RELATION_LABEL } from "@/lib/household-people";

export const Route = createFileRoute("/_authenticated/admin/chiens")({
  head: () => ({
    meta: [
      { title: "Foyers & chiens — Bureau" },
      { name: "description", content: "Vue Bureau des foyers et des chiens : composition, personne de référence et dossiers selon les choix des propriétaires." },
      { property: "og:title", content: "Foyers & chiens — Bureau" },
      { property: "og:description", content: "Vue Bureau des foyers et des chiens de l'association." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type BDog = {
  id: string; name: string; breed: string | null; sex: string | null; household_id: string | null; household: string | null;
  owner: string | null; keeper: string | null; archived_at: string | null; full: boolean; private_sections: string[];
  info: {
    character: string | null; needs: string | null; useful_information: string | null; identification: string | null;
    coat_color: string | null; weight_kg: number | null; arrival_date: string | null; birth_date: string | null;
    sterilization: string | null; living_environment: string | null;
  } | null;
  indicators: { family: string; label: string }[] | null;
  goals: { title: string; status: string }[] | null;
  observations: { body: string; created_at: string }[] | null;
};

const STERIL: Record<string, string> = { YES: "stérilisé·e", NO: "non stérilisé·e" };

function useBureauDogs(enabled: boolean, hidden: boolean | undefined) {
  return useQuery({
    queryKey: ["bureau-dogs", hidden], enabled,
    queryFn: async () => { const { data, error } = await supabase.rpc("bureau_dogs"); if (error) throw error; return (data ?? []) as unknown as BDog[]; },
  });
}

function Page() {
  const { isBureau, rolesReady, user } = useAuth();
  const qc = useQueryClient();
  const { data: hidden } = useQuery({
    queryKey: ["hide-dogs", user?.id], enabled: Boolean(user && isBureau),
    queryFn: async () => (await supabase.from("profiles").select("hide_sensitive_dogs").eq("id", user!.id).maybeSingle()).data?.hide_sensitive_dogs ?? false,
  });
  const { data: dogs = [], isLoading } = useBureauDogs(isBureau, hidden);
  const toggle = useMutation({
    mutationFn: async (v: boolean) => { const { error } = await supabase.from("profiles").update({ hide_sensitive_dogs: v }).eq("id", user!.id); if (error) throw error; },
    onSuccess: () => { toast.success("Visibilité mise à jour."); void qc.invalidateQueries({ queryKey: ["hide-dogs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (rolesReady && !isBureau) return <BureauOnly title="Foyers & chiens" />;
  const active = dogs.filter((d) => !d.archived_at);
  const archived = dogs.filter((d) => d.archived_at);
  return (
    <AppShell title="Foyers & chiens" subtitle="Composition des foyers et dossiers des chiens, selon les choix des propriétaires">
      <Tabs defaultValue="foyers">
        <TabsList>
          <TabsTrigger value="foyers">Foyers</TabsTrigger>
          <TabsTrigger value="chiens">Chiens ({active.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="foyers"><HouseholdsTab dogs={dogs} /></TabsContent>
        <TabsContent value="chiens" className="space-y-4">
          <label className="panel flex min-h-12 items-center gap-2 p-3 text-sm">
            <input type="checkbox" checked={Boolean(hidden)} onChange={(e) => toggle.mutate(e.target.checked)} />
            Masquer pour moi les dossiers détaillés (je ne vois que les informations principales)
          </label>
          {isLoading ? <LoadingState rows={3} /> : active.length === 0 ? <EmptyState title="Aucun chien" message="Aucun chien enregistré pour le moment." /> : (
            <div className="grid gap-3 lg:grid-cols-2">{active.map((d) => <DogCard key={d.id} d={d} />)}</div>
          )}
          {archived.length > 0 && (
            <details className="panel p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Fiches archivées ({archived.length})</summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">{archived.map((d) => <DogCard key={d.id} d={d} />)}</div>
            </details>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function DogCard({ d }: { d: BDog }) {
  const i = d.info;
  const facts = i ? [i.coat_color, i.weight_kg ? `${i.weight_kg} kg` : null, i.sterilization ? STERIL[i.sterilization] : null, i.living_environment].filter(Boolean) : [];
  return (
    <article className="panel space-y-2 p-4 text-sm">
      <h2 className="font-display text-lg">{d.name} {d.archived_at ? <Badge variant="outline">Archivé</Badge> : null}</h2>
      <p className="text-xs text-muted-foreground">{[d.breed, d.sex, d.household ?? d.owner].filter(Boolean).join(" · ")}</p>
      <p className="text-xs">Référent·e : {d.keeper ?? d.owner ?? "titulaire du compte"}</p>
      {d.full ? (
        <>
          {i ? (
            <>
              {facts.length ? <p className="text-xs">{facts.join(" · ")}</p> : null}
              {i.identification ? <p className="text-xs">Identification : {i.identification}</p> : null}
              <p>{[i.character, i.needs, i.useful_information].filter(Boolean).join(" — ") || "Pas d'informations."}</p>
            </>
          ) : <Priv label="Informations" />}
          {d.indicators?.length ? (
            <ul className="flex flex-wrap gap-1">{d.indicators.map((r, n) => <li key={n}><Badge variant="outline">{INDICATOR_FAMILY_LABEL[r.family] ?? r.family} · {r.label}</Badge></li>)}</ul>
          ) : null}
          {d.goals ? <p className="text-xs">Objectifs : {d.goals.map((g) => g.title).join(", ") || "aucun"}</p> : <Priv label="Objectifs" />}
          {d.observations ? <p className="text-xs">{d.observations.length} observation(s) au carnet</p> : <Priv label="Carnet" />}
        </>
      ) : null}
    </article>
  );
}

function HouseholdsTab({ dogs }: { dogs: BDog[] }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bureau-households"],
    queryFn: async () => {
      const [h, m, c] = await Promise.all([
        supabase.from("households").select("id, name, created_at").order("name"),
        supabase.from("household_members").select("id, household_id, user_id, role"),
        supabase.from("household_children").select("id, household_id, first_name, last_name, birth_date, birth_year, relation"),
      ]);
      if (h.error) throw h.error;
      const uids = [...new Set((m.data ?? []).map((x) => x.user_id))];
      const { data: profiles } = uids.length ? await supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", uids) : { data: [] };
      const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Membre"]));
      return { households: h.data ?? [], members: m.data ?? [], people: c.data ?? [], nameOf };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["bureau-households"] });
  if (isLoading || !data) return <LoadingState rows={3} />;
  if (data.households.length === 0) return <EmptyState title="Aucun foyer" message="Aucun foyer créé pour le moment." />;
  const dup = membersInSeveralHouseholds(data.members);
  const removeMember = async (id: string, name: string, household: string) => {
    if (!window.confirm(`Retirer ${name} du foyer « ${household} » ? Ses chiens et son compte ne sont pas modifiés.`)) return;
    const { error } = await supabase.from("household_members").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Membre retiré de ce foyer."); void refresh(); }
  };
  return (
    <div className="space-y-3">
      {dup.size > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {dup.size} membre{dup.size > 1 ? "s apparaissent" : " apparaît"} dans plusieurs foyers. Un membre n'appartient qu'à un seul foyer : retirez le rattachement en trop après en avoir parlé avec la personne.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.households.map((h) => (
          <HouseholdCard key={h.id} h={h} onRenamed={() => void refresh()}
            members={data.members.filter((m) => m.household_id === h.id)}
            people={data.people.filter((p) => p.household_id === h.id)}
            dogs={dogs.filter((d) => d.household_id === h.id && !d.archived_at)}
            nameOf={data.nameOf} dup={dup} onRemove={removeMember} />
        ))}
      </div>
    </div>
  );
}

function HouseholdCard({ h, members, people, dogs, nameOf, dup, onRemove, onRenamed }: {
  h: { id: string; name: string };
  members: { id: string; user_id: string; role: string }[];
  people: { id: string; first_name: string; last_name: string | null; birth_date: string | null; birth_year: number | null; relation: string }[];
  dogs: BDog[]; nameOf: Map<string, string>; dup: Set<string>;
  onRemove: (id: string, name: string, household: string) => void; onRenamed: () => void;
}) {
  const [name, setName] = useState(h.name);
  const rename = async () => {
    if (name.trim().length < 2 || name.trim() === h.name) return;
    const { error } = await supabase.from("households").update({ name: name.trim() }).eq("id", h.id);
    if (error) toast.error(error.message); else { toast.success("Foyer renommé."); onRenamed(); }
  };
  return (
    <article className="panel space-y-3 p-4 text-sm">
      <div className="flex items-center gap-2">
        <Home className="size-4 shrink-0 text-primary" aria-hidden />
        <Input aria-label="Nom du foyer" value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} className="h-9 font-display" />
      </div>
      <div>
        <p className="font-medium">Adultes</p>
        <ul className="space-y-1">
          {members.map((m) => {
            const n = nameOf.get(m.user_id) ?? "Membre";
            return (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>{n} {m.role === "ADMIN" ? <Badge variant="outline">Gestion</Badge> : null} {dup.has(m.user_id) ? <Badge variant="outline">Plusieurs foyers</Badge> : null}</span>
                {dup.has(m.user_id) ? <Button size="sm" variant="ghost" onClick={() => onRemove(m.id, n, h.name)}>Retirer d'ici</Button> : null}
              </li>
            );
          })}
        </ul>
      </div>
      {people.length > 0 && (
        <div>
          <p className="font-medium">Proches sans compte</p>
          <ul>{people.map((p) => { const a = ageFrom(p.birth_date, p.birth_year); return <li key={p.id}>{personLabel(p)} <span className="text-muted-foreground">· {RELATION_LABEL[p.relation] ?? p.relation}{a !== null ? ` · ${a} an${a > 1 ? "s" : ""}` : ""}</span></li>; })}</ul>
        </div>
      )}
      <div>
        <p className="font-medium">Chiens</p>
        {dogs.length === 0 ? <p className="text-muted-foreground">Aucun chien actif.</p> : <p>{dogs.map((d) => `${d.name}${d.keeper ? ` (avec ${d.keeper})` : ""}`).join(", ")}</p>}
      </div>
    </article>
  );
}

function Priv({ label }: { label: string }) {
  return <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" aria-hidden /> {label} : privé (choix du propriétaire)</p>;
}
