import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export type Spots = { capacity: number | null; taken: number; remaining: number | null; full: boolean; waitlist: boolean };

export function useSpots({ activityId, eventId }: { activityId?: string; eventId?: string }) {
  return useQuery({
    queryKey: ["spots", activityId ?? eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("spots_info", { _activity_id: activityId ?? null, _event_id: eventId ?? null } as never);
      if (error) throw error;
      return data as unknown as Spots;
    },
  });
}

export function SpotsBadge({ spots }: { spots: Spots | undefined }) {
  if (!spots) return null;
  if (spots.capacity == null) return <p className="text-sm text-muted-foreground">Places non limitées</p>;
  if (spots.full) return <Badge variant="destructive">{spots.waitlist ? "Complet — liste d'attente ouverte" : "Complet"}</Badge>;
  return (
    <p className="text-sm">
      <strong>{spots.remaining}</strong> place{spots.remaining === 1 ? "" : "s"} restante{spots.remaining === 1 ? "" : "s"} sur {spots.capacity}
    </p>
  );
}

type Exp = { for_you_if: string | null; to_bring: string | null; before_coming: string | null; with_your_dog: string | null };

export function ExperienceSections({ item }: { item: Exp }) {
  const blocks = [
    ["Cette activité est faite pour vous si…", item.for_you_if],
    ["À prévoir", item.to_bring],
    ["Avant de venir", item.before_coming],
    ["Avec votre chien", item.with_your_dog],
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
