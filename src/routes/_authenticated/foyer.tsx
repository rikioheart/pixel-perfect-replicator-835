import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home, Plus, Trash2, UserPlus, Users, Dog } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useMemberOptions } from "@/components/MemberPicker";
import { useMyHouseholds, type HouseholdBundle, type HouseholdPerson } from "@/lib/households";
import { ageFrom, personLabel, RELATION_LABEL } from "@/lib/household-people";
import { DogProfiles } from "@/components/DogProfiles";
import { DogFilePanel } from "@/components/DogFile";

export const Route = createFileRoute("/_authenticated/foyer")({
  head: () => ({
    meta: [
      { title: "Mon foyer — La Voix du Chien" },
      { name: "description", content: "Votre foyer : adultes, proches sans compte, chiens et la personne de référence de chacun." },
      { property: "og:title", content: "Mon foyer — La Voix du Chien" },
      { property: "og:description", content: "Gérez votre foyer, vos proches et les fiches de vos chiens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoyerPage,
});

const select = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
const emptyPerson = { first_name: "", last_name: "", birth_date: "", relation: "ENFANT" };

function friendly(message: string) {
  return message.includes("un seul foyer") ? "Cette personne fait déjà partie d'un autre foyer. Un membre n'appartient qu'à un seul foyer." : message;
}

function PersonRow({ p, dogs, onChanged }: { p: HouseholdPerson; dogs: HouseholdBundle["dogs"]; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ first_name: p.first_name, last_name: p.last_name ?? "", birth_date: p.birth_date ?? "", relation: p.relation });
  const entrusted = dogs.filter((d) => d.keeper_person_id === p.id);
  const age = ageFrom(p.birth_date, p.birth_year);
  const save = async () => {
    if (f.first_name.trim().length < 2) { toast.error("Le prénom est obligatoire."); return; }
    const { error } = await supabase.from("household_children").update({
      first_name: f.first_name.trim(), last_name: f.last_name.trim() || null, birth_date: f.birth_date || null, relation: f.relation,
    }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Personne mise à jour."); setEditing(false); onChanged(); }
  };
  const remove = async () => {
    const warn = entrusted.length ? `\n${entrusted.map((d) => d.name).join(", ")} reviendra sous votre responsabilité.` : "";
    if (!window.confirm(`Retirer ${personLabel(p)} du foyer ?${warn}`)) return;
    const { error } = await supabase.from("household_children").delete().eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Personne retirée du foyer."); onChanged(); }
  };
  if (editing) {
    return (
      <li className="space-y-2 rounded-md border border-border p-3">
        <PersonFields f={f} setF={setF} idPrefix={`p-${p.id}`} />
        <div className="flex gap-2"><Button size="sm" onClick={save}>Enregistrer</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button></div>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
      <div>
        <p className="font-medium">{personLabel(p)}</p>
        <p className="text-xs text-muted-foreground">
          {RELATION_LABEL[p.relation] ?? p.relation}{age !== null ? ` · ${age} an${age > 1 ? "s" : ""}` : ""}
          {entrusted.length ? ` · référent·e de ${entrusted.map((d) => d.name).join(", ")}` : ""}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier</Button>
        <Button size="icon" variant="ghost" aria-label={`Retirer ${personLabel(p)}`} onClick={remove}><Trash2 className="size-4" aria-hidden /></Button>
      </div>
    </li>
  );
}

function PersonFields({ f, setF, idPrefix }: { f: typeof emptyPerson; setF: (v: typeof emptyPerson) => void; idPrefix: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div><Label htmlFor={`${idPrefix}-first`}>Prénom</Label><Input id={`${idPrefix}-first`} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
      <div><Label htmlFor={`${idPrefix}-last`}>Nom (facultatif)</Label><Input id={`${idPrefix}-last`} value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
      <div><Label htmlFor={`${idPrefix}-birth`}>Date de naissance (facultatif)</Label><Input id={`${idPrefix}-birth`} type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></div>
      <div>
        <Label htmlFor={`${idPrefix}-rel`}>Lien</Label>
        <select id={`${idPrefix}-rel`} className={select} value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>
          {Object.entries(RELATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}

function HouseholdCard({ h }: { h: HouseholdBundle }) {
  const qc = useQueryClient();
  const { data: members = [] } = useMemberOptions();
  const [person, setPerson] = useState(emptyPerson);
  const [adding, setAdding] = useState(false);
  const [adult, setAdult] = useState("");
  const refresh = () => Promise.all(["my-households", "my-dogs", "dog-file"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const addAdult = async () => {
    const { error } = await supabase.from("household_members").insert({ household_id: h.id, user_id: adult, role: "ADULT" });
    if (error) toast.error(friendly(error.message)); else { toast.success("Adulte ajouté au foyer."); setAdult(""); void refresh(); }
  };
  const addPerson = async () => {
    if (person.first_name.trim().length < 2) { toast.error("Le prénom est obligatoire."); return; }
    const { error } = await supabase.from("household_children").insert({
      household_id: h.id, first_name: person.first_name.trim(), last_name: person.last_name.trim() || null,
      birth_date: person.birth_date || null, relation: person.relation,
    });
    if (error) toast.error(error.message); else { toast.success("Personne ajoutée au foyer."); setPerson(emptyPerson); setAdding(false); void refresh(); }
  };

  return (
    <section className="panel space-y-5 p-5" aria-labelledby={`hh-${h.id}`}>
      <h2 id={`hh-${h.id}`} className="flex items-center gap-2 font-display text-xl"><Home className="size-5 text-primary" aria-hidden /> {h.name}</h2>
      <div className="grid gap-5 text-sm lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-medium"><Users className="size-4" aria-hidden /> Adultes avec un compte</h3>
          <ul className="space-y-1">
            {h.adults.map((a) => <li key={a.user_id}>{a.name} {a.role === "ADMIN" ? <Badge variant="outline">Gestion du foyer</Badge> : null}</li>)}
          </ul>
          <div className="flex gap-1">
            <select aria-label="Ajouter un adulte" className={`${select} min-w-0 flex-1`} value={adult} onChange={(e) => setAdult(e.target.value)}>
              <option value="">Ajouter un membre de l'association…</option>
              {members.filter((m) => !h.adults.some((a) => a.user_id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <Button size="icon" variant="outline" aria-label="Ajouter l'adulte" disabled={!adult} onClick={addAdult}><UserPlus className="size-4" aria-hidden /></Button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-medium">Proches sans compte</h3>
          {h.children.length === 0 ? <p className="text-muted-foreground">Enfants, conjoint·e ou autre proche qui vient avec le chien.</p> : (
            <ul className="space-y-2">{h.children.map((p) => <PersonRow key={p.id} p={p} dogs={h.dogs} onChanged={() => void refresh()} />)}</ul>
          )}
          {adding ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <PersonFields f={person} setF={setPerson} idPrefix={`new-${h.id}`} />
              <div className="flex gap-2"><Button size="sm" onClick={addPerson}>Ajouter</Button><Button size="sm" variant="ghost" onClick={() => { setAdding(false); setPerson(emptyPerson); }}>Annuler</Button></div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden /> Ajouter un proche</Button>
          )}
          <p className="text-xs text-muted-foreground">Visible par les adultes du foyer et, si besoin, par le Bureau. Jamais par les autres participants.</p>
        </div>
      </div>
      <div className="space-y-1 border-t border-border pt-4 text-sm">
        <h3 className="flex items-center gap-2 font-medium"><Dog className="size-4" aria-hidden /> Chiens du foyer</h3>
        {h.dogs.length === 0 ? <p className="text-muted-foreground">Aucun chien rattaché à ce foyer.</p> : (
          <ul className="flex flex-wrap gap-2">
            {h.dogs.map((d) => {
              const k = h.children.find((c) => c.id === d.keeper_person_id);
              return <li key={d.id}><Badge variant="outline">{d.name} · {k ? `avec ${personLabel(k)}` : "titulaire du compte"}</Badge></li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function FoyerPage() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: households = [], isLoading } = useMyHouseholds(user?.id);
  const { data: orphanDogs = [] } = useQuery({
    queryKey: ["orphan-dogs", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => (await supabase.from("dogs").select("id,name").eq("owner_id", user!.id).is("household_id", null)).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const name = `Foyer ${profile?.last_name || profile?.first_name || ""}`.trim();
      const { data, error } = await supabase.from("households").insert({ name, created_by: user!.id }).select("id").single();
      if (error) throw new Error(friendly(error.message));
      if (orphanDogs.length) await supabase.from("dogs").update({ household_id: data.id }).in("id", orphanDogs.map((d) => d.id));
    },
    onSuccess: () => { toast.success("Foyer créé."); void qc.invalidateQueries({ queryKey: ["my-households"] }); void qc.invalidateQueries({ queryKey: ["orphan-dogs"] }); void qc.invalidateQueries({ queryKey: ["my-dogs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Mon foyer" subtitle="Vos proches, vos chiens et la personne de référence de chacun"
      actions={households.length === 0 && !isLoading ? <Button size="sm" className="gap-2" onClick={() => create.mutate()} disabled={create.isPending}><Plus className="size-4" aria-hidden /> Créer mon foyer</Button> : undefined}>
      {isLoading ? <LoadingState rows={3} /> : households.length === 0 ? (
        <EmptyState title="Pas encore de foyer" message="Créez votre foyer pour inscrire en une fois vos proches et vos chiens. Vos chiens existants y seront rattachés." />
      ) : (
        <div className="space-y-4">
          {households.length > 1 && (
            <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
              Vous apparaissez dans {households.length} foyers. Un membre n'appartient normalement qu'à un seul foyer : le Bureau peut vous aider à les regrouper.
            </p>
          )}
          {households.map((h) => <HouseholdCard key={h.id} h={h} />)}
        </div>
      )}
      <DogProfiles households={households} onOpen={(id) => setOpen(id)} />
      {open ? <DogFilePanel dogId={open} onClose={() => setOpen(null)} /> : null}
    </AppShell>
  );
}
