import { supabase } from "@/integrations/supabase/client";
import { CONTRIBUTION_TYPES } from "@/lib/contributions";

/**
 * Détails de profil protégés (présentation, ville, compétences, disponibilités).
 * Ils ne se lisent jamais en direct dans la table : soi-même et le Bureau passent par
 * profile_details ; l'annuaire et l'aperçu « tel que les autres me voient » passent par
 * directory_profiles, qui applique les choix de visibilité côté base.
 */

export type FieldVisibility = "MEMBERS" | "PRIVATE";

export type ProfileDetails = {
  id: string;
  bio: string | null;
  city: string | null;
  department: string | null;
  skills: string[];
  availability: string[];
  collaboration_modes: string[];
  contribution_types: string[];
  bio_visibility: FieldVisibility;
  location_visibility: FieldVisibility;
  skills_visibility: FieldVisibility;
  availability_visibility: FieldVisibility;
};

export type DirectoryProfile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  membership_type: string;
  membership_status: string;
  public_visibility: boolean;
  city: string | null;
  department: string | null;
  bio: string | null;
  skills: string[];
  availability: string[];
  collaboration_modes: string[];
  contribution_types: string[];
};

export const AVAILABILITY_OPTIONS: [string, string][] = [
  ["SEMAINE", "En semaine, en journée"],
  ["SOIR", "En soirée"],
  ["WEEKEND", "Le week-end"],
  ["PONCTUEL", "Ponctuellement"],
];

export const COLLABORATION_MODES: [string, string][] = [
  ["PRESENTIEL", "Sur place"],
  ["DISTANCE", "À distance"],
  ["ASYNCHRONE", "À mon rythme (messages, documents)"],
  ["COLLECTIF", "En petit groupe"],
];

/** Mêmes types que « Je veux aider » : une seule liste de contributions dans le produit. */
export const CONTRIBUTION_PREFERENCES = CONTRIBUTION_TYPES;

export const VISIBILITY_LABEL: Record<FieldVisibility, string> = {
  MEMBERS: "Membres de l'annuaire",
  PRIVATE: "Moi et le Bureau",
};

export const labelOf = (options: [string, string][], code: string) => options.find(([c]) => c === code)?.[1] ?? code;

export const SKILLS_MAX = 30;
export const BIO_MAX = 600;

/** Nettoie une liste de compétences : sans vide, sans doublon (casse ignorée), limitée. */
export function normalizeSkills(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const value = raw.trim().slice(0, 60);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.slice(0, SKILLS_MAX);
}

/** Initiales pour l'avatar par défaut (prénom + nom, sinon nom affiché). */
export function initialsOf(p: { display_name?: string | null; first_name?: string | null; last_name?: string | null }): string {
  const parts = [p.first_name, p.last_name].filter((x): x is string => Boolean(x?.trim()));
  const source = parts.length ? parts : (p.display_name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = source.slice(0, 2).map((w) => w.trim()[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

export async function fetchProfileDetails(ids: string[]): Promise<Map<string, ProfileDetails>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.rpc("profile_details", { _ids: ids });
  if (error) throw error;
  return new Map(((data ?? []) as ProfileDetails[]).map((d) => [d.id, d]));
}

/** Annuaire réel. `asMember` = vue d'un membre, même pour le Bureau (aperçu de son propre profil). */
export async function fetchDirectoryProfiles(opts: { ids?: string[]; asMember?: boolean } = {}): Promise<DirectoryProfile[]> {
  const args: { _ids?: string[]; _as_member?: boolean } = {};
  if (opts.ids) args._ids = opts.ids;
  if (opts.asMember) args._as_member = true;
  const { data, error } = await supabase.rpc("directory_profiles", args);
  if (error) throw error;
  return (data ?? []) as DirectoryProfile[];
}

export async function fetchMySkills(userId: string): Promise<string[]> {
  const details = await fetchProfileDetails([userId]);
  return (details.get(userId)?.skills ?? []).filter((s) => s.trim());
}

/** URL signée (1 h) d'une photo du bucket privé « avatars » ; null si absente ou non autorisée. */
export async function signedAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}
