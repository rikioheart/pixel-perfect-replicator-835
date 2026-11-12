import { MapPin } from "lucide-react";
import { ProfileExtras } from "@/components/ProfileExtras";
import type { DirectoryProfile } from "@/lib/profile-details";

/** Corps d'une fiche de l'annuaire (ville, présentation, compétences, envies) : utilisé par l'annuaire et par l'aperçu du profil. */
export function MemberSummary({ person }: { person: Pick<DirectoryProfile, "city" | "department" | "bio" | "skills" | "availability" | "collaboration_modes" | "contribution_types"> }) {
  return (
    <>
      {person.city || person.department ? (
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden /> {[person.city, person.department].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {person.bio ? <p className="mt-3 line-clamp-3 text-sm">{person.bio}</p> : null}
      <ProfileExtras person={person} />
    </>
  );
}
