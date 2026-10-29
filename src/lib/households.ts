import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HouseholdPerson = {
  id: string; first_name: string; last_name: string | null; birth_date: string | null; birth_year: number | null; relation: string;
};

export type HouseholdBundle = {
  id: string;
  name: string;
  adults: { user_id: string; role: string; name: string }[];
  /** Personnes du foyer sans compte (enfants, conjoint, parent…). */
  children: HouseholdPerson[];
  dogs: { id: string; name: string; breed: string | null; keeper_person_id: string | null }[];
};

/** Foyers dont l'utilisateur fait partie (un seul attendu), avec adultes, personnes sans compte et chiens. */
export function useMyHouseholds(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-households", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HouseholdBundle[]> => {
      // Le Bureau lit tous les foyers : on ne garde que ceux dont l'utilisateur est membre.
      const { data: mine, error: e1 } = await supabase.from("household_members").select("household_id").eq("user_id", userId!);
      if (e1) throw e1;
      const ids = [...new Set((mine ?? []).map((m) => m.household_id))];
      if (ids.length === 0) return [];
      const { data: hh, error } = await supabase.from("households").select("id,name").in("id", ids).order("created_at");
      if (error) throw error;
      const [members, children, dogs] = await Promise.all([
        supabase.from("household_members").select("household_id,user_id,role").in("household_id", ids),
        supabase.from("household_children").select("id,household_id,first_name,last_name,birth_date,birth_year,relation").in("household_id", ids).order("created_at"),
        supabase.from("dogs").select("id,household_id,name,breed,keeper_person_id").in("household_id", ids).is("archived_at", null),
      ]);
      const uids = [...new Set((members.data ?? []).map((m) => m.user_id))];
      const { data: profiles } = uids.length
        ? await supabase.from("profiles").select("id,display_name,first_name,last_name").in("id", uids)
        : { data: [] };
      const nameOf = new Map(
        (profiles ?? []).map((p) => [p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Adulte"]),
      );
      return (hh ?? []).map((h) => ({
        id: h.id,
        name: h.name,
        adults: (members.data ?? [])
          .filter((m) => m.household_id === h.id)
          .map((m) => ({ user_id: m.user_id, role: m.role, name: m.user_id === userId ? "Moi" : nameOf.get(m.user_id) ?? "Adulte" })),
        children: (children.data ?? []).filter((c) => c.household_id === h.id),
        dogs: (dogs.data ?? []).filter((d) => d.household_id === h.id),
      }));
    },
  });
}
