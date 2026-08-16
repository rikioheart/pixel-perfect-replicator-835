import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** URL affichable d'une photo de profil (chemin de stockage ou URL complète). */
export function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/**
 * Professionnels les plus actifs du mois : nombre d'activités et d'événements
 * auxquels ils sont rattachés sur le mois en cours.
 */
export function useActiveProsOfMonth() {
  return useQuery({
    queryKey: ["active-pros-month"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const [activities, events] = await Promise.all([
        supabase
          .from("activities")
          .select("professional_ids, date")
          .gte("date", start)
          .lt("date", end),
        supabase
          .from("events")
          .select("professional_ids, start_date")
          .gte("start_date", start)
          .lt("start_date", end),
      ]);

      const counts = new Map<string, number>();
      for (const row of [...(activities.data ?? []), ...(events.data ?? [])]) {
        for (const id of row.professional_ids ?? []) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
      const ranked = [...counts.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      return new Map(ranked);
    },
  });
}
