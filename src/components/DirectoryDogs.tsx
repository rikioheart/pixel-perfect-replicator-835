import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHouseholds } from "@/lib/households";
import { DOG_SOURCE_LABEL, dogSourcesFor, type DogSource } from "@/lib/directory-dogs";
import { EntityPeek } from "@/components/EntityPeek";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

type Row = { id: string; name: string; breed: string | null; context: string | null; source: DogSource; archived: boolean };

const LINK: Record<DogSource, "/foyer" | "/espace-pro/chiens" | "/admin/chiens"> = {
  household: "/foyer",
  pro: "/espace-pro/chiens",
  bureau: "/admin/chiens",
};

/**
 * Fiches chiens de l'annuaire. Aucune lecture directe des chiens d'autres personnes :
 * foyer via useMyHouseholds (foyers dont on est membre), pro via get_pro_dogs(), Bureau via bureau_dogs().
 */
export function DirectoryDogs({ search }: { search: string }) {
  const { user, isBureau, isPro } = useAuth();
  const sources = dogSourcesFor({ isBureau, isPro });
  const [only, setOnly] = useState<DogSource | "ALL">("ALL");
  const households = useMyHouseholds(user?.id);

  const pro = useQuery({
    queryKey: ["directory-pro-dogs", user?.id],
    enabled: sources.includes("pro"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pro_dogs");
      if (error) throw error;
      return (data ?? []) as { id: string; identity?: { name?: string; breed?: string | null } | null; is_referent?: boolean }[];
    },
  });

  const bureau = useQuery({
    queryKey: ["directory-bureau-dogs", user?.id],
    enabled: sources.includes("bureau"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bureau_dogs");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; breed: string | null; household: string | null; owner: string | null; archived_at: string | null }[];
    },
  });

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    const push = (r: Row) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      out.push(r);
    };
    for (const h of households.data ?? [])
      for (const d of h.dogs) push({ id: d.id, name: d.name, breed: d.breed, context: h.name, source: "household", archived: false });
    for (const d of pro.data ?? [])
      push({
        id: d.id,
        name: d.identity?.name ?? "Chien accompagné",
        breed: d.identity?.breed ?? null,
        context: d.is_referent ? "Référent" : "Accès partagé",
        source: "pro",
        archived: false,
      });
    for (const d of bureau.data ?? [])
      push({
        id: d.id,
        name: d.name,
        breed: d.breed,
        context: [d.household, d.owner].filter(Boolean).join(" · ") || null,
        source: "bureau",
        archived: Boolean(d.archived_at),
      });
    return out;
  }, [households.data, pro.data, bureau.data]);

  const term = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) => (only === "ALL" || r.source === only) && (!term || `${r.name} ${r.breed ?? ""} ${r.context ?? ""}`.toLowerCase().includes(term)),
  );
  const loading = households.isLoading || pro.isLoading || bureau.isLoading;

  return (
    <section aria-label="Fiches chiens">
      <p className="mb-3 text-xs text-muted-foreground">
        {isBureau
          ? "Registre du Bureau : rubriques privées masquées selon vos droits."
          : isPro
            ? "Vos chiens et ceux dont le dossier vous a été partagé."
            : "Seuls les chiens de votre foyer apparaissent ici."}
      </p>
      {sources.length > 1 ? (
        <div role="group" aria-label="Origine des fiches" className="mb-4 flex flex-wrap gap-1">
          {(["ALL", ...sources] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={only === s}
              onClick={() => setOnly(s)}
              className={only === s ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"}
            >
              {s === "ALL" ? "Toutes" : DOG_SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">Chargement des fiches…</p>
      ) : shown.length === 0 ? (
        <EmptyState title="Aucune fiche chien" message={rows.length === 0 ? "Aucun chien accessible pour votre profil." : "Aucun chien ne correspond à la recherche."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <article key={`${d.source}-${d.id}`} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-base font-bold">
                  <EntityPeek type="dog" id={d.id}>
                    <span className="inline-flex items-center gap-1.5"><Dog className="size-4 text-primary" aria-hidden /> {d.name}</span>
                  </EntityPeek>
                </h2>
                <Badge variant="outline">{DOG_SOURCE_LABEL[d.source]}</Badge>
              </div>
              {d.breed ? <p className="mt-1 text-xs text-muted-foreground">{d.breed}</p> : null}
              {d.context ? <p className="mt-1 text-xs text-muted-foreground">{d.context}</p> : null}
              {d.archived ? <Badge variant="secondary" className="mt-2">Archivé</Badge> : null}
              <Link to={LINK[d.source]} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
                Ouvrir la fiche
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
