import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HandHeart, HeartHandshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/lib/user-preferences";
import { BADGES, earnedBadges, type BadgeCode } from "@/lib/recognition";

const ICON: Record<BadgeCode, typeof HandHeart> = { PREMIER_COUP_DE_MAIN: HandHeart, BIENFAITEUR_ACTIF: HeartHandshake };

/**
 * Marques de reconnaissance personnelles, calculées à partir de décisions humaines déjà enregistrées.
 * Visibles seulement par la personne, jamais comparées ; rien ne s'affiche tant qu'aucune n'est obtenue.
 */
export function RecognitionCard() {
  const { user, roles, profile } = useAuth();
  const { preferences } = useUserPreferences();
  const enabled = Boolean(user?.id) && preferences?.show_recognition !== false;
  const { data: tasksValidatedByOthers } = useQuery({
    queryKey: ["recognition-tasks", user?.id],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Tâches qui m'étaient confiées, terminées puis validées par quelqu'un d'autre (guard_task_lifecycle).
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_user_id", user!.id)
        .in("status", ["COMPLETED", "ARCHIVED"])
        .not("validated_by", "is", null)
        .neq("validated_by", user!.id);
      if (error) return 0;
      return count ?? 0;
    },
  });
  if (!enabled || tasksValidatedByOthers === undefined) return null;
  const badges = earnedBadges({ tasksValidatedByOthers, roles, membershipStatus: profile?.membership_status });
  if (!badges.length) return null;
  return (
    <section className="panel p-4" aria-labelledby="recognition-title">
      <h2 id="recognition-title" className="font-display text-lg">Merci pour ce que vous apportez</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {badges.map((code) => {
          const Icon = ICON[code];
          return (
            <li key={code} className="flex items-start gap-3 rounded-lg bg-gold-soft p-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{BADGES[code].label}</span>
                <span className="block text-xs text-foreground">{BADGES[code].message}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Elles ne s'affichent que pour vous, sans comparaison ni classement.{" "}
        <Link to="/my-space" className="underline underline-offset-2">Les masquer</Link>
      </p>
    </section>
  );
}
