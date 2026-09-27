import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HouseholdBundle = {
  id: string;
  name: string;
  adults: { user_id: string; role: string; name: string }[];
  children: { id: string; first_name: string; birth_year: number | null }[];
  dogs: { id: string; name: string; breed: string | null }[];
};

/** Foyers dont l'utilisateur fait partie, avec adultes, enfants et chiens. */
export function useMyHouseholds(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-households", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HouseholdBundle[]> => {
      const { data: hh, error } = await supabase.from("households").select("id,name").order("created_at");
      if (error) throw error;
      const ids = (hh ?? []).map((h) => h.id);
      if (ids.length === 0) return [];
      const [members, children, dogs] = await Promise.all([
        supabase.from("household_members").select("household_id,user_id,role").in("household_id", ids),
        supabase.from("household_children").select("id,household_id,first_name,birth_year").in("household_id", ids),
        supabase.from("dogs").select("id,household_id,name,breed").in("household_id", ids),
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
