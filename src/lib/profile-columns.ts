import { supabase } from "@/integrations/supabase/client";
import { fetchProfileDetails, type ProfileDetails } from "@/lib/profile-details";

/**
 * Colonnes de profil lisibles par l'API. E-mail et téléphone passent par profile_contacts ; présentation,
 * ville, département, compétences et disponibilités par profile_details (soi-même ou Bureau) ou par
 * directory_profiles (annuaire, selon la visibilité choisie).
 */
export const PROFILE_COLUMNS =
  "id, first_name, last_name, display_name, avatar_path, membership_type, membership_status, membership_date, involvement_level, public_visibility, created_at, updated_at, access_level, person_id, hide_sensitive_dogs, account_choice_at, deleted_at";

type Contact = { id: string; email: string | null; phone: string | null };

type PrivateFields = { email: string | null; phone: string | null } & Partial<Omit<ProfileDetails, "id">>;

/**
 * Ajoute e-mail, téléphone et détails privés quand la base l'autorise (soi-même ou Bureau) ;
 * sinon les champs restent vides, sans écraser ceux déjà fournis par la ligne.
 */
export async function withContacts<T extends { id: string }>(rows: T[]): Promise<(T & PrivateFields)[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [contacts, details] = await Promise.all([
    supabase.rpc("profile_contacts", { _ids: ids }),
    fetchProfileDetails(ids).catch(() => new Map<string, ProfileDetails>()),
  ]);
  const map = new Map(((contacts.data ?? []) as Contact[]).map((c) => [c.id, c]));
  return rows.map((r) => {
    const d = details.get(r.id);
    const { id: _ignored, ...rest } = d ?? ({} as Partial<ProfileDetails>);
    return { ...r, ...(d ? rest : {}), email: map.get(r.id)?.email ?? null, phone: map.get(r.id)?.phone ?? null };
  });
}
