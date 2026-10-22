import { supabase } from "@/integrations/supabase/client";

/** Colonnes de profil lisibles par l'API. E-mail et téléphone passent par profile_contacts (soi-même ou Bureau). */
export const PROFILE_COLUMNS =
  "id, first_name, last_name, display_name, avatar_path, city, department, membership_type, membership_status, membership_date, involvement_level, bio, public_visibility, created_at, updated_at, access_level, person_id, hide_sensitive_dogs, statutory_category";

type Contact = { id: string; email: string | null; phone: string | null };

/** Ajoute e-mail et téléphone quand la base l'autorise ; sinon null. */
export async function withContacts<T extends { id: string }>(rows: T[]): Promise<(T & { email: string | null; phone: string | null })[]> {
  if (!rows.length) return [];
  const { data } = await supabase.rpc("profile_contacts", { _ids: rows.map((r) => r.id) });
  const map = new Map(((data ?? []) as Contact[]).map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, email: map.get(r.id)?.email ?? null, phone: map.get(r.id)?.phone ?? null }));
}
