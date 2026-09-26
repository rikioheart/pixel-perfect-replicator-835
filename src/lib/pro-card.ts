import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PRO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente de validation",
  ACTIVE: "Publiée",
  SUSPENDED: "Suspendue",
};

export const DOG_POLICY_LABEL: Record<string, string> = {
  NONE: "Sans chien",
  OPTIONAL: "Chien facultatif",
  REQUIRED: "Avec un chien",
  MULTIPLE: "Plusieurs chiens possibles",
};

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function publicProUrl(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/professionnels/${slug}`;
}

export type ProOption = { id: string; name: string; sector: string | null };

/** Professionnels publiés : utilisés pour choisir un référent, partager un chien, etc. */
export function useProOptions() {
  return useQuery({
    queryKey: ["pro-options"],
    queryFn: async (): Promise<ProOption[]> => {
      const { data, error } = await supabase
        .from("professional_public_profile")
        .select("profile_id, display_name, sector")
        .eq("status", "ACTIVE")
        .order("display_name");
      if (error) throw error;
      return (data ?? []).map((p) => ({ id: p.profile_id, name: p.display_name, sector: p.sector }));
    },
  });
}

/** Complétion progressive du profil professionnel (0–100). */
export function completion(p: {
  display_name?: string | null;
  logo_url?: string | null;
  specialties?: string[] | null;
  sector?: string | null;
  description?: string | null;
  website_url?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
}) {
  const checks = [
    Boolean(p.display_name),
    Boolean(p.logo_url),
    (p.specialties ?? []).length > 0,
    Boolean(p.sector),
    (p.description ?? "").length >= 40,
    Boolean(p.website_url),
    Boolean(p.public_email || p.public_phone),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
