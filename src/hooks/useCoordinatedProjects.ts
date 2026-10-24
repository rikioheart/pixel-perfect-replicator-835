import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Projets dont l'utilisateur est responsable ou coordinateur (rôle projet ou fonction contextuelle active). */
export function useCoordinatedProjects(userId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["coordinated-projects", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [members, functions] = await Promise.all([
        supabase.from("project_members").select("project_id, project_role").eq("user_id", userId!),
        supabase
          .from("member_functions")
          .select("scope_id, function_type, end_date")
          .eq("user_id", userId!)
          .eq("active", true)
          .eq("scope_type", "PROJECT"),
      ]);
      const ids = new Set<string>();
      for (const m of members.data ?? []) {
        if (["OWNER", "COORDINATOR"].includes((m.project_role ?? "").toUpperCase())) ids.add(m.project_id);
      }
      for (const f of functions.data ?? []) {
        const ok = ["COORDINATOR", "COORDINATEUR"].includes((f.function_type ?? "").toUpperCase());
        if (ok && f.scope_id && (!f.end_date || f.end_date >= today)) ids.add(f.scope_id);
      }
      return [...ids];
    },
  });
  return new Set(data ?? []);
}
