import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserPreferences = {
  user_id: string;
  text_size: string;
  high_contrast: boolean;
  reduced_motion: boolean;
  default_view: string;
  notify_email: boolean;
  notify_in_app: boolean;
  notify_reminders: boolean;
};

const DEFAULTS: Omit<UserPreferences, "user_id"> = {
  text_size: "NORMAL",
  high_contrast: false,
  reduced_motion: false,
  default_view: "LIST",
  notify_email: true,
  notify_in_app: true,
  notify_reminders: true,
};

export const TEXT_SIZES: [string, string][] = [
  ["NORMAL", "Normale"],
  ["LARGE", "Confortable"],
  ["XLARGE", "Très grande"],
];

export const DEFAULT_VIEWS: [string, string][] = [
  ["LIST", "Liste"],
  ["CARDS", "Cartes"],
  ["KANBAN", "Kanban"],
];

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user-preferences", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as UserPreferences | null) ?? { user_id: user!.id, ...DEFAULTS };
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Omit<UserPreferences, "user_id">>) => {
      const next = { ...DEFAULTS, ...(query.data ?? {}), ...patch, user_id: user!.id };
      const { error } = await supabase.from("user_preferences").upsert(next, { onConflict: "user_id" });
      if (error) throw error;
      return next;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-preferences", user?.id] }),
  });

  return { preferences: query.data ?? { user_id: user?.id ?? "", ...DEFAULTS }, isLoading: query.isLoading, save };
}

/** Applique les préférences d'accessibilité sur le document (taille, contraste, animations). */
export function useApplyPreferences() {
  const { preferences } = useUserPreferences();
  const { text_size, high_contrast, reduced_motion } = preferences;

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = text_size === "XLARGE" ? "19px" : text_size === "LARGE" ? "17px" : "";
    root.classList.toggle("prefs-high-contrast", high_contrast);
    root.classList.toggle("prefs-reduced-motion", reduced_motion);
  }, [text_size, high_contrast, reduced_motion]);
}
