import { supabase } from "@/integrations/supabase/client";

export type LoyaltyRule = {
  id: string;
  code: string | null;
  label: string | null;
  description: string | null;
  scope: string;
  match_code: string | null;
  activity_id: string | null;
  event_id: string | null;
  stamps_given: number;
  eligible_membership_types: string[];
  tier_threshold: number | null;
  reward_label: string | null;
  priority: number;
  is_active: boolean;
};

export const LOYALTY_SCOPES: { value: string; label: string; hint: string }[] = [
  { value: "ACTIVITY_TYPE", label: "Par type d'activité", hint: "S'applique à toutes les activités d'un type (balade, atelier…)" },
  { value: "ACTIVITY", label: "Activité précise", hint: "Barème dédié à une activité identifiée" },
  { value: "ACTIVITY_ANY", label: "Toute activité", hint: "Barème de base pour n'importe quelle activité éligible" },
  { value: "EVENT_ANY", label: "Tout événement", hint: "Présence validée sur un événement associatif" },
  { value: "TIER", label: "Palier / récompense", hint: "Seuil de tampons donnant droit à une récompense" },
];

export const LOYALTY_SCOPE_LABEL: Record<string, string> = Object.fromEntries(
  LOYALTY_SCOPES.map((s) => [s.value, s.label]),
);

export const MEMBERSHIP_TYPES = ["PARTICULIER", "PROFESSIONNEL", "BUREAU"] as const;

export async function fetchLoyaltyRules(): Promise<LoyaltyRule[]> {
  const { data, error } = await supabase
    .from("loyalty_rules")
    .select(
      "id, code, label, description, scope, match_code, activity_id, event_id, stamps_given, eligible_membership_types, tier_threshold, reward_label, priority, is_active",
    )
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LoyaltyRule[];
}

/** Simulation côté client du moteur appliqué automatiquement en base. */
export function previewStamps(
  rules: LoyaltyRule[],
  context: { activityType?: string | null; activityId?: string | null; isEvent?: boolean; membershipType?: string | null },
) {
  return rules
    .filter((rule) => rule.is_active && rule.scope !== "TIER" && rule.stamps_given > 0)
    .filter(
      (rule) =>
        rule.eligible_membership_types.length === 0 ||
        (context.membershipType ? rule.eligible_membership_types.includes(context.membershipType) : false),
    )
    .filter((rule) => {
      if (rule.scope === "ACTIVITY") return Boolean(context.activityId) && rule.activity_id === context.activityId;
      if (rule.scope === "ACTIVITY_TYPE") return Boolean(context.activityType) && rule.match_code === context.activityType;
      if (rule.scope === "ACTIVITY_ANY") return Boolean(context.activityId || context.activityType);
      if (rule.scope === "EVENT_ANY") return Boolean(context.isEvent);
      return false;
    });
}

export function nextTier(rules: LoyaltyRule[], totalStamps: number) {
  return rules
    .filter((rule) => rule.is_active && rule.scope === "TIER" && (rule.tier_threshold ?? 0) > totalStamps)
    .sort((a, b) => (a.tier_threshold ?? 0) - (b.tier_threshold ?? 0))[0];
}
