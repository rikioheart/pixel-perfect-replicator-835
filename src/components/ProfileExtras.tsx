import {
  AVAILABILITY_OPTIONS,
  COLLABORATION_MODES,
  CONTRIBUTION_PREFERENCES,
  labelOf,
} from "@/lib/profile-details";

type Extras = { skills: string[]; availability: string[]; collaboration_modes: string[]; contribution_types: string[] };

/** Compétences, disponibilités et envies d'aider, telles que renvoyées par la base (déjà filtrées). */
export function ProfileExtras({ person }: { person: Extras }) {
  const timing = [
    ...person.availability.map((c) => labelOf(AVAILABILITY_OPTIONS, c)),
    ...person.collaboration_modes.map((c) => labelOf(COLLABORATION_MODES, c)),
  ];
  const wishes = person.contribution_types.map((c) => labelOf(CONTRIBUTION_PREFERENCES, c));
  if (!person.skills.length && !timing.length && !wishes.length) return null;
  return (
    <dl className="mt-3 space-y-2 text-xs">
      {person.skills.length ? (
        <div>
          <dt className="sr-only">Compétences et centres d'intérêt</dt>
          <dd>
            <ul className="flex flex-wrap gap-1.5" aria-label="Compétences et centres d'intérêt">
              {person.skills.map((s) => (
                <li key={s} className="rounded-full bg-primary-tint px-2.5 py-0.5 text-foreground">{s}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
      {timing.length ? (
        <div className="flex flex-wrap gap-1">
          <dt className="font-medium">Disponible :</dt>
          <dd className="text-muted-foreground">{timing.join(" · ")}</dd>
        </div>
      ) : null}
      {wishes.length ? (
        <div className="flex flex-wrap gap-1">
          <dt className="font-medium">Envie d'aider :</dt>
          <dd className="text-muted-foreground">{wishes.join(" · ")}</dd>
        </div>
      ) : null}
    </dl>
  );
}
