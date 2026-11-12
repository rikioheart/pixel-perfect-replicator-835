import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf, signedAvatarUrl } from "@/lib/profile-details";
import { cn } from "@/lib/utils";

/**
 * Photo de profil facultative ; initiales par défaut. La photo vient du bucket privé « avatars »
 * par URL signée : la base décide qui peut la voir (soi-même, Bureau, membre visible dans l'annuaire).
 */
export function UserAvatar({
  path,
  person,
  className,
  decorative = true,
}: {
  path: string | null | undefined;
  person: { display_name?: string | null; first_name?: string | null; last_name?: string | null };
  className?: string;
  decorative?: boolean;
}) {
  const { data: url } = useQuery({
    queryKey: ["avatar-url", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: () => signedAvatarUrl(path),
  });
  const name = person.display_name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Membre";
  return (
    <Avatar className={cn("size-12", className)} aria-hidden={decorative || undefined}>
      {url ? <AvatarImage src={url} alt={decorative ? "" : `Photo de ${name}`} className="object-cover" /> : null}
      <AvatarFallback className="bg-primary-tint font-medium text-foreground">{initialsOf(person)}</AvatarFallback>
    </Avatar>
  );
}
