import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Baby, Home, Plus, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useMemberOptions } from "@/components/MemberPicker";
import { useMyHouseholds, type HouseholdBundle } from "@/lib/households";
import { DogProfiles } from "@/components/DogProfiles";
import { DogFilePanel } from "@/components/DogFile";

export const Route = createFileRoute("/_authenticated/foyer")({
  head: () => ({
    meta: [
      { title: "Mon foyer — La Voix du Chien" },
      { name: "description", content: "Adultes, enfants et chiens de votre foyer, fiche de chaque chien et partage avec les professionnels." },
      { property: "og:title", content: "Mon foyer — La Voix du Chien" },
      { property: "og:description", content: "Gérez votre foyer et le partage des fiches de vos chiens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoyerPage,
});

function HouseholdCard({ h }: { h: HouseholdBundle }) {
  const qc = useQueryClient();
  const { data: members = [] } = useMemberOptions();
  const [child, setChild] = useState({ first_name: "", birth_year: "" });
  const [adult, setAdult] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["my-households"] });
  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => async () => {
    const { error } = await fn();
    if (error) toast.error(error.message); else { toast.success(ok); refresh(); }
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby={`hh-${h.id}`}>
      <h2 id={`hh-${h.id}`} className="flex items-center gap-2 font-display text-xl"><Home className="size-5 text-primary" aria-hidden /> {h.name}</h2>
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div className="space-y-2">
          <h3 className="font-medium">Adultes</h3>
          {h.adults.map((a) => <div key={a.user_id}>{a.name} {a.role === "ADMIN" ? <Badge variant="outline">Gestion</Badge> : null}</div>)}
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
      </div>
    </section>
  );
}

function FoyerPage() {
  const { user, profile } = useAuth();
  const [sharing, setSharing] = useState<string | null>(null);
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
    <AppShell title="Mon foyer" subtitle="Vos proches, les fiches de vos chiens et leurs professionnels"
      actions={<Button size="sm" className="gap-2" onClick={() => create.mutate()} disabled={create.isPending}><Plus className="size-4" aria-hidden /> {households.length ? "Autre foyer" : "Créer mon foyer"}</Button>}>
      {isLoading ? <LoadingState rows={3} /> : households.length === 0 ? (
        <EmptyState title="Pas encore de foyer" message="Créez votre foyer pour inscrire en une fois vos proches, vos enfants et vos chiens. Vos chiens existants y seront rattachés." />
      ) : (
        <div className="space-y-4">{households.map((h) => <HouseholdCard key={h.id} h={h} />)}</div>
      )}
      <DogProfiles households={households} onOpen={(id) => setSharing(id)} />
      {sharing ? <DogFilePanel dogId={sharing} onClose={() => setSharing(null)} /> : null}
    </AppShell>
  );
}
