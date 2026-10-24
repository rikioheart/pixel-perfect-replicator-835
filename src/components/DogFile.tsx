import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Eye, Flag, Share2, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidePanel } from "@/components/SidePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProOptions } from "@/lib/pro-card";
import { buildDogTimeline, GOAL_STATUS, INDICATOR_FAMILY_LABEL } from "@/lib/dog-timeline";
import {
  activeAccesses, availablePros, hasAnySection, INDICATOR_CATEGORY_LABEL, sectionsSummary,
  SHARE_PRESETS, SHARE_SECTIONS, shareResultMessage, type AccessRow, type SharePerms,
} from "@/lib/dog-sharing";

export type DogFileTab = "fiche" | "reperes" | "carnet" | "pros";

const select = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
const endOfDay = (d: string) => (d ? new Date(`${d}T23:59:59`).toISOString() : (null as unknown as string));
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function useRefreshDog(dogId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [["dog-file", dogId], ["dog-sharing", dogId], ["my-dog-home"], ["my-dogs"], ["my-households"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );
}

/** Fiche unique du chien : profil, repères, carnet de vie et professionnels, au même endroit. */
export function DogFilePanel({ dogId, initialTab = "fiche", onClose }: { dogId: string; initialTab?: DogFileTab; onClose: () => void }) {
  const [tab, setTab] = useState<DogFileTab>(initialTab);
  const { data: dog } = useQuery({
    queryKey: ["dog-file", dogId],
    queryFn: async () => {
      const { data, error } = await supabase.from("dogs").select("*").eq("id", dogId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return (
    <SidePanel open onOpenChange={(o) => !o && onClose()} title={dog ? `Fiche de ${dog.name}` : "Fiche du chien"}
      description="Tout ce qui concerne votre chien, au même endroit. Vous décidez de ce que chacun peut voir.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as DogFileTab)}>
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="fiche">Profil</TabsTrigger>
          <TabsTrigger value="reperes">Repères</TabsTrigger>
          <TabsTrigger value="carnet">Carnet</TabsTrigger>
          <TabsTrigger value="pros">Pros</TabsTrigger>
        </TabsList>
        <TabsContent value="fiche">{dog ? <ProfileTab dog={dog} /> : null}</TabsContent>
        <TabsContent value="reperes"><IndicatorsTab dogId={dogId} /></TabsContent>
        <TabsContent value="carnet"><JournalTab dogId={dogId} /></TabsContent>
        <TabsContent value="pros"><ProsTab dogId={dogId} /></TabsContent>
      </Tabs>
    </SidePanel>
  );
}

type DogRow = {
  id: string; name: string; breed: string | null; sex: string | null; birth_date: string | null;
  character: string | null; needs: string | null; useful_information: string | null;
};

function ProfileTab({ dog }: { dog: DogRow }) {
  const refresh = useRefreshDog(dog.id);
  const [f, setF] = useState(() => ({
    name: dog.name, breed: dog.breed ?? "", sex: dog.sex ?? "", birth_date: dog.birth_date ?? "",
    character: dog.character ?? "", needs: dog.needs ?? "", useful_information: dog.useful_information ?? "",
  }));
  const save = useMutation({
    mutationFn: async () => {
      if (f.name.trim().length < 2) throw new Error("Le nom du chien est obligatoire.");
      const { error } = await supabase.from("dogs").update({
        name: f.name.trim(), breed: f.breed.trim() || null, sex: f.sex || null, birth_date: f.birth_date || null,
        character: f.character.trim() || null, needs: f.needs.trim() || null, useful_information: f.useful_information.trim() || null,
      }).eq("id", dog.id);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Fiche enregistrée."); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="space-y-3 pt-3 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div><Label htmlFor="df-name">Nom</Label><Input id="df-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="df-breed">Race</Label><Input id="df-breed" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} /></div>
        <div>
          <Label htmlFor="df-sex">Sexe</Label>
          <select id="df-sex" className={select} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}>
            <option value="">Non précisé</option><option value="Mâle">Mâle</option><option value="Femelle">Femelle</option>
          </select>
        </div>
      </div>
      <div><Label htmlFor="df-birth">Naissance</Label><Input id="df-birth" type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></div>
      <div><Label htmlFor="df-char">Caractère</Label><Textarea id="df-char" value={f.character} onChange={(e) => setF({ ...f, character: e.target.value })} /></div>
      <div><Label htmlFor="df-needs">Besoin du moment</Label><Textarea id="df-needs" value={f.needs} onChange={(e) => setF({ ...f, needs: e.target.value })} /></div>
      <div>
        <Label htmlFor="df-info">Bon à savoir pour l'accueillir</Label>
        <Textarea id="df-info" placeholder="Ex. a peur des vélos, adore la balle" value={f.useful_information} onChange={(e) => setF({ ...f, useful_information: e.target.value })} />
      </div>
      <Button type="submit" disabled={save.isPending}>Enregistrer</Button>
    </form>
  );
}

function IndicatorsTab({ dogId }: { dogId: string }) {
  const refresh = useRefreshDog(dogId);
  const [n, setN] = useState({ family: "VERT", category: "INTERACTION_CHIEN", label: "", note: "" });
  const { data: items = [] } = useQuery({
    queryKey: ["dog-file", dogId, "indicators"],
    queryFn: async () => (await supabase.from("dog_indicators").select("id, family, category, label, note").eq("dog_id", dogId).order("created_at")).data ?? [],
  });
  const qc = useQueryClient();
  const done = async (msg: string) => { toast.success(msg); await refresh(); void qc.invalidateQueries({ queryKey: ["dog-file", dogId, "indicators"] }); };
  const add = useMutation({
    mutationFn: async () => {
      if (n.label.trim().length < 3) throw new Error("Décrivez le repère en quelques mots.");
      const { error } = await supabase.from("dog_indicators").insert({ dog_id: dogId, family: n.family, category: n.category, label: n.label.trim(), note: n.note.trim() || null });
      if (error) throw error;
    },
    onSuccess: async () => { setN({ ...n, label: "", note: "" }); await done("Repère ajouté."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("dog_indicators").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => done("Repère retiré."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4 pt-3 text-sm">
      <p className="text-muted-foreground">Des repères pour bien l'accueillir, jamais une note. Ils sont visibles des professionnels qui encadrent ses sorties.</p>
      {items.length === 0 ? <p className="text-muted-foreground">Aucun repère pour l'instant.</p> : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
              <div>
                <p><Badge variant="outline">{INDICATOR_FAMILY_LABEL[i.family] ?? i.family}</Badge> <span className="font-medium">{i.label}</span></p>
                <p className="text-xs text-muted-foreground">{INDICATOR_CATEGORY_LABEL[i.category] ?? i.category}{i.note ? ` · ${i.note}` : ""}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label={`Retirer le repère ${i.label}`} onClick={() => remove.mutate(i.id)}><Trash2 className="size-4" aria-hidden /></Button>
            </li>
          ))}
        </ul>
      )}
      <fieldset className="space-y-2 border-t border-border pt-3">
        <legend className="font-medium">Ajouter un repère</legend>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Famille du repère" className={select} value={n.family} onChange={(e) => setN({ ...n, family: e.target.value })}>
            {Object.entries(INDICATOR_FAMILY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select aria-label="Situation concernée" className={select} value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>
            {Object.entries(INDICATOR_CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <Input aria-label="Repère" placeholder="Ex. joue volontiers avec les petits chiens" value={n.label} onChange={(e) => setN({ ...n, label: e.target.value })} />
        <Input aria-label="Précision facultative" placeholder="Précision (facultatif)" value={n.note} onChange={(e) => setN({ ...n, note: e.target.value })} />
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Ajouter le repère</Button>
      </fieldset>
    </div>
  );
}

function JournalTab({ dogId }: { dogId: string }) {
  const refresh = useRefreshDog(dogId);
  const qc = useQueryClient();
  const [obs, setObs] = useState("");
  const [goal, setGoal] = useState("");
  const key = ["dog-file", dogId, "journal"];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [o, g, p] = await Promise.all([
        supabase.from("dog_observations").select("id, body, created_at").eq("dog_id", dogId).order("created_at", { ascending: false }).limit(40),
        supabase.from("dog_goals").select("id, title, status, created_at").eq("dog_id", dogId).order("created_at"),
        supabase.from("participation_dogs")
          .select("participations(id, registration_status, registered_at, activities(title, date), events(title, start_date))")
          .eq("dog_id", dogId).limit(40),
      ]);
      const outings = (p.data ?? []).flatMap((row) => {
        const pa = row.participations as unknown as {
          id: string; registration_status: string; registered_at: string;
          activities: { title: string; date: string | null } | null; events: { title: string; start_date: string | null } | null;
        } | null;
        return pa ? [{ id: pa.id, title: pa.activities?.title ?? pa.events?.title ?? "Sortie", date: pa.activities?.date ?? pa.events?.start_date ?? pa.registered_at, status: pa.registration_status }] : [];
      });
      return { goals: g.data ?? [], timeline: buildDogTimeline({ observations: o.data ?? [], goals: g.data ?? [], outings }) };
    },
  });
  const done = async (msg: string) => { toast.success(msg); await refresh(); void qc.invalidateQueries({ queryKey: key }); };
  const addObs = useMutation({
    mutationFn: async () => {
      if (obs.trim().length < 3) throw new Error("Quelques mots suffisent, mais pas moins de trois lettres.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("dog_observations").insert({ dog_id: dogId, body: obs.trim(), author_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: async () => { setObs(""); await done("Ajouté au carnet."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addGoal = useMutation({
    mutationFn: async () => {
      if (goal.trim().length < 3) throw new Error("Décrivez l'objectif en quelques mots.");
      const { error } = await supabase.from("dog_goals").insert({ dog_id: dogId, title: goal.trim() });
      if (error) throw error;
    },
    onSuccess: async () => { setGoal(""); await done("Objectif ajouté."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await supabase.from("dog_goals").update({ status: v.status }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => done("Objectif mis à jour."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-5 pt-3 text-sm">
      <section className="space-y-2">
        <h3 className="font-medium">Objectifs</h3>
        {(data?.goals ?? []).map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1">{g.title}</span>
            <select aria-label={`Avancement de ${g.title}`} className="h-9 rounded-md border border-input bg-background px-2" value={g.status}
              onChange={(e) => setStatus.mutate({ id: g.id, status: e.target.value })}>
              {["EN_COURS", "ATTEINT", "ABANDONNE"].map((s) => <option key={s} value={s}>{GOAL_STATUS[s]}</option>)}
            </select>
          </div>
        ))}
        <div className="flex gap-2">
          <Input aria-label="Nouvel objectif" placeholder="Ex. marcher en laisse détendue" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => addGoal.mutate()} disabled={addGoal.isPending}>Ajouter</Button>
        </div>
      </section>
      <section className="space-y-2 border-t border-border pt-4">
        <h3 className="font-medium">Noter un moment</h3>
        <Textarea aria-label="Observation" placeholder="Un progrès, une réaction, une belle balade…" value={obs} onChange={(e) => setObs(e.target.value)} />
        <Button size="sm" onClick={() => addObs.mutate()} disabled={addObs.isPending}>Ajouter au carnet</Button>
      </section>
      <section className="space-y-2 border-t border-border pt-4" aria-label="Carnet de vie">
        <h3 className="font-medium">Carnet de vie</h3>
        {(data?.timeline ?? []).length === 0 ? <p className="text-muted-foreground">Ses sorties, objectifs et observations apparaîtront ici.</p> : (
          <ol className="space-y-2 border-l-2 border-border pl-4">
            {data!.timeline.map((it) => {
              const Icon = it.kind === "OUTING" ? CalendarDays : it.kind === "GOAL" ? Flag : Eye;
              return (
                <li key={it.key}>
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" aria-hidden />
                    <span className="font-medium">{it.title}</span>
                    {it.upcoming ? <Badge variant="secondary">À venir</Badge> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(it.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}{it.detail ? ` · ${it.detail}` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

type FullAccess = AccessRow & { context: string | null; granted_by: string | null };

function AccessEditor({ access, name, onDone }: { access: FullAccess; name: string; onDone: () => void }) {
  const [perms, setPerms] = useState<SharePerms>(() => ({
    can_identity: access.can_identity, can_info: access.can_info, can_goals: access.can_goals,
    can_activities: access.can_activities, can_observations: access.can_observations,
  }));
  const [until, setUntil] = useState(toDateInput(access.expires_at));
  const save = useMutation({
    mutationFn: async () => {
      if (!hasAnySection(perms)) throw new Error("Gardez au moins une rubrique, ou retirez l'accès.");
      const { error } = await supabase.rpc("update_dog_access", {
        _access_id: access.id, _identity: perms.can_identity, _info: perms.can_info, _goals: perms.can_goals,
        _activities: perms.can_activities, _observations: perms.can_observations, _expires_at: endOfDay(until),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Accès de ${name} mis à jour.`); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
      <fieldset className="grid grid-cols-2 gap-1">
        <legend className="sr-only">Rubriques visibles par {name}</legend>
        {SHARE_SECTIONS.map(([k, l]) => (
          <label key={k} className="flex min-h-9 items-center gap-2">
            <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} /> {l}
          </label>
        ))}
      </fieldset>
      <Label htmlFor={`until-${access.id}`}>Jusqu'au (vide = sans date de fin)</Label>
      <Input id={`until-${access.id}`} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
    </div>
  );
}

function ProsTab({ dogId }: { dogId: string }) {
  const { user } = useAuth();
  const refresh = useRefreshDog(dogId);
  const { data: allPros = [] } = useProOptions();
  const pros = useMemo(() => allPros.filter((p) => p.id !== user?.id), [allPros, user?.id]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [perms, setPerms] = useState<SharePerms>(SHARE_PRESETS[0]!.perms);
  const [until, setUntil] = useState("");
  const [context, setContext] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["dog-sharing", dogId],
    queryFn: async () => {
      const [acc, refs, dog] = await Promise.all([
        supabase.from("dog_professional_access").select("*").eq("dog_id", dogId).order("created_at"),
        supabase.from("dog_referents").select("*").eq("dog_id", dogId),
        supabase.from("dogs").select("private_sections, referent_can_share_followup").eq("id", dogId).maybeSingle(),
      ]);
      return { access: (acc.data ?? []) as FullAccess[], refs: refs.data ?? [], dog: dog.data };
    },
  });
  const access = data?.access ?? [];
  const active = activeAccesses(access);
  const offered = availablePros(pros, access).filter((p) =>
    `${p.name} ${p.sector ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const nameOf = (id: string | null) => allPros.find((p) => p.id === id)?.name ?? "Professionnel";
  useEffect(() => { setChosen((c) => c.filter((id) => !active.some((a) => a.professional_id === id))); }, [active.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const grant = useMutation({
    mutationFn: async () => {
      if (!chosen.length) throw new Error("Cochez au moins un professionnel.");
      if (!hasAnySection(perms)) throw new Error("Choisissez au moins une rubrique.");
      if (context.trim().length < 3) throw new Error("Indiquez le contexte du partage.");
      const { data: res, error } = await supabase.rpc("share_dog_access_many", {
        _dog_id: dogId, _professional_ids: chosen,
        _identity: perms.can_identity, _info: perms.can_info, _goals: perms.can_goals,
        _activities: perms.can_activities, _observations: perms.can_observations,
        _context: context.trim(), _expires_at: endOfDay(until),
      });
      if (error) throw error;
      return res as unknown as { shared: string[]; skipped: string[] };
    },
    onSuccess: async (res) => { toast.success(shareResultMessage(res, nameOf)); setChosen([]); setContext(""); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc("revoke_dog_access", { _access_id: id }); if (error) throw error; },
    onSuccess: async () => { toast.success("Accès retiré, ainsi que les partages qui en découlent."); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateDog = useMutation({
    mutationFn: async (patch: { private_sections?: string[]; referent_can_share_followup?: boolean }) => {
      const { error } = await supabase.from("dogs").update(patch).eq("id", dogId);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Préférence enregistrée."); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleRef = useMutation({
    mutationFn: async (proId: string) => {
      const existing = data?.refs.find((r) => r.professional_id === proId);
      const { error } = existing
        ? await supabase.from("dog_referents").delete().eq("id", existing.id)
        : await supabase.from("dog_referents").insert({ dog_id: dogId, professional_id: proId });
      if (error) throw error;
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const privateSections = data?.dog?.private_sections ?? [];
  const presetId = SHARE_PRESETS.find((p) => SHARE_SECTIONS.every(([k]) => p.perms[k] === perms[k]))?.id;

  return (
    <div className="space-y-5 pt-3 text-sm">
      <section className="space-y-2" aria-labelledby="pros-active">
        <h3 id="pros-active" className="font-medium">Ils ont accès à son dossier ({active.length})</h3>
        {active.length === 0 ? <p className="text-muted-foreground">Personne pour l'instant.</p> : null}
        {active.map((a) => (
          <div key={a.id} className="rounded-md border border-border p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{nameOf(a.professional_id)}</p>
                <p className="text-xs text-muted-foreground">
                  {sectionsSummary(a)}{a.expires_at ? ` · jusqu'au ${new Date(a.expires_at).toLocaleDateString("fr-FR")}` : ""}
                </p>
                {a.context ? <p className="text-xs text-muted-foreground">Contexte : {a.context}</p> : null}
                {a.source_access_id ? <p className="text-xs text-muted-foreground">Partagé par le référent {nameOf(a.granted_by)}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" aria-expanded={editing === a.id} onClick={() => setEditing(editing === a.id ? null : a.id)}>Modifier</Button>
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(a.id)}>Retirer</Button>
              </div>
            </div>
            {editing === a.id ? <AccessEditor access={a} name={nameOf(a.professional_id)} onDone={() => { setEditing(null); void refresh(); }} /> : null}
          </div>
        ))}
      </section>

      <section className="space-y-3 border-t border-border pt-4" aria-labelledby="pros-share">
        <h3 id="pros-share" className="font-medium">Ouvrir son dossier à un ou plusieurs professionnels</h3>
        <div className="space-y-1">
          <Input aria-label="Rechercher un professionnel" placeholder="Rechercher par nom ou métier" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border p-1" role="group" aria-label="Professionnels">
            {offered.length === 0 ? <p className="p-2 text-muted-foreground">Aucun autre professionnel disponible.</p> : offered.map((p) => (
              <label key={p.id} className="flex min-h-9 items-center gap-2 rounded px-1 hover:bg-muted/50">
                <input type="checkbox" checked={chosen.includes(p.id)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))} />
                <span>{p.name}{p.sector ? <span className="text-muted-foreground"> — {p.sector}</span> : null}</span>
              </label>
            ))}
          </div>
          {chosen.length ? <p className="text-xs text-muted-foreground">{chosen.length} professionnel(s) choisi(s)</p> : null}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Ce qu'ils verront</p>
          <div className="flex flex-wrap gap-1">
            {SHARE_PRESETS.map((p) => (
              <Button key={p.id} size="sm" type="button" variant={presetId === p.id ? "default" : "outline"} title={p.hint} onClick={() => setPerms(p.perms)}>{p.label}</Button>
            ))}
          </div>
          <fieldset className="grid grid-cols-2 gap-1">
            <legend className="sr-only">Rubriques visibles</legend>
            {SHARE_SECTIONS.map(([k, l]) => (
              <label key={k} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} /> {l}
              </label>
            ))}
          </fieldset>
        </div>
        <div>
          <Label htmlFor="sh-ctx">Pourquoi ce partage ? (obligatoire)</Label>
          <Input id="sh-ctx" placeholder="Ex. séances d'éducation au printemps" value={context} onChange={(e) => setContext(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sh-until">Jusqu'au (facultatif)</Label>
          <Input id="sh-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <Button className="gap-2" onClick={() => grant.mutate()} disabled={grant.isPending || !chosen.length}>
          <Share2 className="size-4" aria-hidden /> {chosen.length > 1 ? `Partager avec ${chosen.length} professionnels` : "Partager"}
        </Button>
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h3 className="font-medium">Professionnels référents</h3>
        <p className="text-xs text-muted-foreground">Ceux qui suivent votre chien dans la durée. Vous pouvez en choisir plusieurs.</p>
        {data?.refs.length ? (
          <ul className="flex flex-wrap gap-1">
            {data.refs.map((r) => <li key={r.id}><Badge variant="secondary" className="gap-1"><Star className="size-3" aria-hidden />{nameOf(r.professional_id)}</Badge></li>)}
          </ul>
        ) : null}
        <details>
          <summary className="cursor-pointer text-primary">Choisir les référents</summary>
          <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {pros.map((p) => (
              <label key={p.id} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={Boolean(data?.refs.some((r) => r.professional_id === p.id))} onChange={() => toggleRef.mutate(p.id)} /> {p.name}
              </label>
            ))}
          </div>
        </details>
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h3 className="font-medium">Confidentialité</h3>
        <label className="flex min-h-9 items-start gap-2">
          <input type="checkbox" className="mt-1" checked={Boolean(data?.dog?.referent_can_share_followup)}
            onChange={(e) => updateDog.mutate({ referent_can_share_followup: e.target.checked })} />
          J'autorise mes référents à transmettre le suivi (objectifs, observations) à d'autres professionnels. Si je retire cet accord, ce qu'ils ont transmis est retiré aussi.
        </label>
        <p className="text-xs text-muted-foreground">Rubriques privées, cachées au Bureau :</p>
        {([["info", "Informations"], ["goals", "Objectifs"], ["observations", "Observations et suivis"]] as const).map(([k, l]) => (
          <label key={k} className="flex min-h-9 items-center gap-2">
            <input type="checkbox" checked={privateSections.includes(k)}
              onChange={(e) => updateDog.mutate({ private_sections: e.target.checked ? [...privateSections, k] : privateSections.filter((s) => s !== k) })} /> {l}
          </label>
        ))}
      </section>
    </div>
  );
}

