import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Baby, Dog, Home, Plus, Share2, Star, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidePanel } from "@/components/SidePanel";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useMemberOptions } from "@/components/MemberPicker";
import { useMyHouseholds, type HouseholdBundle } from "@/lib/households";
import { useProOptions } from "@/lib/pro-card";

export const Route = createFileRoute("/_authenticated/foyer")({
  head: () => ({
    meta: [
      { title: "Mon foyer — La Voix du Chien" },
      { name: "description", content: "Adultes, enfants et chiens de votre foyer, partages avec les professionnels et référents." },
      { property: "og:title", content: "Mon foyer — La Voix du Chien" },
      { property: "og:description", content: "Gérez votre foyer et le partage des fiches de vos chiens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoyerPage,
});

const PERMS = [
  ["can_identity", "Identité"],
  ["can_info", "Informations"],
  ["can_goals", "Objectifs"],
  ["can_activities", "Activités"],
  ["can_observations", "Observations"],
] as const;
type PermKey = (typeof PERMS)[number][0];

function DogSharing({ dogId, dogName, onClose }: { dogId: string; dogName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: pros = [] } = useProOptions();
  const [pro, setPro] = useState("");
  const [perms, setPerms] = useState<Record<PermKey, boolean>>({ can_identity: true, can_info: false, can_goals: false, can_activities: false, can_observations: false });
  const [until, setUntil] = useState("");

  const { data } = useQuery({
    queryKey: ["dog-sharing", dogId],
    queryFn: async () => {
      const [acc, refs] = await Promise.all([
        supabase.from("dog_professional_access").select("*").eq("dog_id", dogId),
        supabase.from("dog_referents").select("*").eq("dog_id", dogId),
      ]);
      return { access: acc.data ?? [], refs: refs.data ?? [] };
    },
  });
  const nameOf = (id: string) => pros.find((p) => p.id === id)?.name ?? "Professionnel";
  const refresh = () => void qc.invalidateQueries({ queryKey: ["dog-sharing", dogId] });

  const grant = useMutation({
    mutationFn: async () => {
      if (!pro) throw new Error("Choisissez un professionnel.");
      const { error } = await supabase.from("dog_professional_access").upsert(
        { dog_id: dogId, professional_id: pro, ...perms, revoked: false, expires_at: until ? new Date(until).toISOString() : null },
        { onConflict: "dog_id,professional_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Accès partagé."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dog_professional_access").update({ revoked: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Accès retiré."); refresh(); },
  });
  const toggleRef = useMutation({
    mutationFn: async (proId: string) => {
      const existing = data?.refs.find((r) => r.professional_id === proId);
      const { error } = existing
        ? await supabase.from("dog_referents").delete().eq("id", existing.id)
        : await supabase.from("dog_referents").insert({ dog_id: dogId, professional_id: proId });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SidePanel open onOpenChange={(o) => !o && onClose()} title={`Partage — ${dogName}`} description="Vous choisissez ce que chaque professionnel peut voir. Retirable à tout moment.">
      <div className="space-y-5 text-sm">
        <section className="space-y-2">
          <h3 className="font-medium">Accès en cours</h3>
          {(data?.access ?? []).filter((a) => !a.revoked).length === 0 ? <p className="text-muted-foreground">Aucun partage.</p> : null}
          {(data?.access ?? []).filter((a) => !a.revoked).map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
              <div>
                <p className="font-medium">{nameOf(a.professional_id)}</p>
                <p className="text-xs text-muted-foreground">
                  {PERMS.filter(([k]) => a[k]).map(([, l]) => l).join(", ") || "Aucune rubrique"}
                  {a.expires_at ? ` · jusqu'au ${new Date(a.expires_at).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(a.id)}>Retirer</Button>
            </div>
          ))}
        </section>
        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-medium">Partager avec un professionnel</h3>
          <Label htmlFor="sh-pro">Professionnel</Label>
          <select id="sh-pro" className="h-10 w-full rounded-md border border-input bg-background px-2" value={pro} onChange={(e) => setPro(e.target.value)}>
            <option value="">Choisir…</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sector ? ` — ${p.sector}` : ""}</option>)}
          </select>
          <fieldset className="grid grid-cols-2 gap-1">
            <legend className="mb-1 text-xs text-muted-foreground">Rubriques visibles</legend>
            {PERMS.map(([k, l]) => (
              <label key={k} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} /> {l}
              </label>
            ))}
          </fieldset>
          <Label htmlFor="sh-until">Jusqu'au (facultatif)</Label>
          <Input id="sh-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          <Button className="gap-2" onClick={() => grant.mutate()} disabled={grant.isPending}><Share2 className="size-4" aria-hidden /> Partager</Button>
        </section>
        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-medium">Professionnels référents</h3>
          <p className="text-xs text-muted-foreground">Vous pouvez en choisir plusieurs.</p>
          {pros.map((p) => {
            const on = Boolean(data?.refs.some((r) => r.professional_id === p.id));
            return (
              <label key={p.id} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => toggleRef.mutate(p.id)} /> {p.name} {on ? <Star className="size-3 text-primary" aria-hidden /> : null}
              </label>
            );
          })}
        </section>
      </div>
    </SidePanel>
  );
}

function HouseholdCard({ h }: { h: HouseholdBundle }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: members = [] } = useMemberOptions();
  const [child, setChild] = useState({ first_name: "", birth_year: "" });
  const [dog, setDog] = useState({ name: "", breed: "" });
  const [adult, setAdult] = useState("");
  const [sharing, setSharing] = useState<{ id: string; name: string } | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["my-households"] });
  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => async () => {
    const { error } = await fn();
    if (error) toast.error(error.message); else { toast.success(ok); refresh(); }
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby={`hh-${h.id}`}>
      <h2 id={`hh-${h.id}`} className="flex items-center gap-2 font-display text-xl"><Home className="size-5 text-primary" aria-hidden /> {h.name}</h2>
      <div className="grid gap-4 md:grid-cols-3 text-sm">
        <div className="space-y-2">
          <h3 className="font-medium">Adultes</h3>
          {h.adults.map((a) => <p key={a.user_id}>{a.name} {a.role === "ADMIN" ? <Badge variant="outline">Gestion</Badge> : null}</p>)}
          <div className="flex gap-1">
            <select aria-label="Ajouter un adulte" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2" value={adult} onChange={(e) => setAdult(e.target.value)}>
              <option value="">Ajouter un adulte…</option>
              {members.filter((m) => !h.adults.some((a) => a.user_id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <Button size="icon" variant="outline" aria-label="Ajouter l'adulte" disabled={!adult}
              onClick={run(() => supabase.from("household_members").insert({ household_id: h.id, user_id: adult }), "Adulte ajouté.")}>
              <UserPlus className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-1 font-medium"><Baby className="size-4" aria-hidden /> Enfants</h3>
          {h.children.map((c) => (
            <p key={c.id} className="flex items-center justify-between">{c.first_name}{c.birth_year ? ` (${c.birth_year})` : ""}
              <Button size="icon" variant="ghost" aria-label={`Retirer ${c.first_name}`} onClick={run(() => supabase.from("household_children").delete().eq("id", c.id), "Retiré.")}><Trash2 className="size-4" aria-hidden /></Button>
            </p>
          ))}
          <div className="flex gap-1">
            <Input aria-label="Prénom de l'enfant" placeholder="Prénom" value={child.first_name} onChange={(e) => setChild({ ...child, first_name: e.target.value })} />
            <Input aria-label="Année de naissance" placeholder="Année" className="w-20" value={child.birth_year} onChange={(e) => setChild({ ...child, birth_year: e.target.value })} />
            <Button size="icon" variant="outline" aria-label="Ajouter l'enfant" disabled={child.first_name.trim().length < 2}
              onClick={run(() => { const r = supabase.from("household_children").insert({ household_id: h.id, first_name: child.first_name.trim(), birth_year: Number(child.birth_year) || null }); setChild({ first_name: "", birth_year: "" }); return r; }, "Enfant ajouté.")}>
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Prénom seulement, jamais visible des autres participants.</p>
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-1 font-medium"><Dog className="size-4" aria-hidden /> Chiens</h3>
          {h.dogs.map((d) => (
            <p key={d.id} className="flex items-center justify-between gap-1">{d.name}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setSharing({ id: d.id, name: d.name })}><Share2 className="size-3.5" aria-hidden /> Partage & référents</Button>
            </p>
          ))}
          <div className="flex gap-1">
            <Input aria-label="Nom du chien" placeholder="Nom" value={dog.name} onChange={(e) => setDog({ ...dog, name: e.target.value })} />
            <Input aria-label="Race" placeholder="Race" value={dog.breed} onChange={(e) => setDog({ ...dog, breed: e.target.value })} />
            <Button size="icon" variant="outline" aria-label="Ajouter le chien" disabled={dog.name.trim().length < 2}
              onClick={run(() => { const r = supabase.from("dogs").insert({ owner_id: user!.id, household_id: h.id, name: dog.name.trim(), breed: dog.breed.trim() || null }); setDog({ name: "", breed: "" }); return r; }, "Chien ajouté.")}>
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
      {sharing ? <DogSharing dogId={sharing.id} dogName={sharing.name} onClose={() => setSharing(null)} /> : null}
    </section>
  );
}

function FoyerPage() {
  const { user, profile } = useAuth();
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
      if (error) throw error;
      if (orphanDogs.length) await supabase.from("dogs").update({ household_id: data.id }).in("id", orphanDogs.map((d) => d.id));
    },
    onSuccess: () => { toast.success("Foyer créé."); void qc.invalidateQueries({ queryKey: ["my-households"] }); void qc.invalidateQueries({ queryKey: ["orphan-dogs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Mon foyer" subtitle="Les personnes et les chiens que vous inscrivez ensemble"
      actions={<Button size="sm" className="gap-2" onClick={() => create.mutate()} disabled={create.isPending}><Plus className="size-4" aria-hidden /> {households.length ? "Autre foyer" : "Créer mon foyer"}</Button>}>
      {isLoading ? <LoadingState rows={3} /> : households.length === 0 ? (
        <EmptyState title="Pas encore de foyer" message="Créez votre foyer pour inscrire en une fois vos proches, vos enfants et vos chiens. Vos chiens existants y seront rattachés." />
      ) : (
        <div className="space-y-4">{households.map((h) => <HouseholdCard key={h.id} h={h} />)}</div>
      )}
    </AppShell>
  );
}
