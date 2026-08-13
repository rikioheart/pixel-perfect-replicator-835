import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConfigOption = {
  id: string;
  family: string;
  code: string;
  label: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  metadata?: {
    task_statuses?: string[];
    document_category?: string | null;
    requires_file?: boolean;
  } | null;
};

/**
 * Tout ce qui peut évoluer dans l'association est paramétrable ici,
 * sans réécrire l'application.
 */
export const CONFIG_FAMILIES: { family: string; label: string; hint: string }[] = [
  { family: "PROFESSIONAL_CATEGORY", label: "Catégories professionnelles", hint: "Métiers des professionnels adhérents" },
  { family: "PROJECT_CATEGORY", label: "Catégories de projets", hint: "Familles de projets pilotées par le Bureau" },
  { family: "ACTIVITY_TYPE", label: "Types d'activités", hint: "Balades, ateliers, formations…" },
  { family: "EVENT_TYPE", label: "Types d'événements", hint: "Salons, assemblées, collectes…" },
  { family: "INVOLVEMENT_LEVEL", label: "Niveaux d'implication", hint: "Du simple observateur au moteur du collectif" },
  { family: "PROJECT_ROLE", label: "Rôles projet", hint: "Rôle tenu au sein d'un projet, indépendant du rôle principal" },
  { family: "LOYALTY_RULE", label: "Règles de fidélité", hint: "Attribution des tampons et seuils de récompense" },
  { family: "ACCESS_LEVEL", label: "Niveaux d'accès", hint: "Étendue de l'accès, séparée du rôle principal" },
  { family: "TASK_STATUS", label: "Statuts de tâches", hint: "Cycle de vie des actions" },
  { family: "PROJECT_STATUS", label: "Statuts de projets", hint: "Cycle de vie des projets" },
  { family: "MEMBERSHIP_STATUS", label: "Statuts d'adhésion", hint: "État de l'adhésion d'un membre" },
  { family: "PARTNER_CATEGORY", label: "Catégories de partenaires", hint: "Commerces, collectivités, marques…" },
  { family: "DOCUMENT_CATEGORY", label: "Catégories de documents", hint: "Classement de la bibliothèque partagée" },
  { family: "PROOF_TYPE", label: "Types de preuves", hint: "Preuves acceptées selon le statut de la tâche (photo, facture, compte-rendu…)" },
  { family: "VISIBILITY", label: "Visibilités", hint: "Qui voit quoi : public, association, projet, bureau, privé" },
  { family: "MEMBER_FUNCTION", label: "Fonctions associatives", hint: "Badges qui complètent le rôle principal sans l'écraser" },
  { family: "PRO_LEVEL", label: "Niveaux professionnels", hint: "Standard, avancé, coordinateur" },
  { family: "PARTICULIER_LEVEL", label: "Niveaux particuliers", hint: "Standard, impliqué, bénévole validé, référent" },
  { family: "PRIORITY", label: "Priorités", hint: "Échelle de priorité des actions" },
];

export const CONFIG_FAMILY_LABEL: Record<string, string> = Object.fromEntries(
  CONFIG_FAMILIES.map((f) => [f.family, f.label]),
);

export async function fetchConfigOptions(family?: string): Promise<ConfigOption[]> {
  let query = supabase
    .from("config_options")
    .select("id, family, code, label, description, color, sort_order, is_active, is_system")
    .order("family", { ascending: true })
    .order("sort_order", { ascending: true });
  if (family) query = query.eq("family", family);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ConfigOption[];
}

/** Options actives d'une famille, utilisables dans n'importe quel formulaire. */
export function useConfigOptions(family: string) {
  const query = useQuery({
    queryKey: ["config-options", family],
    queryFn: () => fetchConfigOptions(family),
    staleTime: 60_000,
  });
  const options = (query.data ?? []).filter((o) => o.is_active);
  const labelOf = (code: string | null | undefined, fallback?: Record<string, string>) =>
    (code &&
      ((query.data ?? []).find((o) => o.code === code)?.label ?? fallback?.[code])) ||
    code ||
    "—";
  return { ...query, options, labelOf };
}
