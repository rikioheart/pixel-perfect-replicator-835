import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildGreeting, localDay, type Greeting } from "@/lib/greeting";

/**
 * Salutation du jour : le message chaleureux complet s'affiche à la première visite de la journée
 * sur cet appareil, puis une salutation courte (aucune phrase répétée à chaque passage).
 * Date et saison lues après l'affichage initial, pour un rendu serveur identique.
 */
export function useGreeting({
  name,
  dogNames,
  roleMessage,
}: {
  name: string | null | undefined;
  dogNames?: (string | null | undefined)[];
  roleMessage?: string;
}): Greeting {
  const { user } = useAuth();
  const [state, setState] = useState<{ full: boolean; date: Date } | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    const key = `lvdc.greeted.${user.id}`;
    let full = true;
    try {
      full = localStorage.getItem(key) !== localDay(now);
      localStorage.setItem(key, localDay(now));
    } catch {
      full = false; // sans stockage, rester sobre plutôt que répéter le message long
    }
    setState({ full, date: now });
  }, [user?.id]);
  return buildGreeting({ name, dogNames, roleMessage, date: state?.date ?? new Date(0), full: state?.full ?? false });
}

/** Bandeau de bienvenue compact (espace pro, Console) : sans photo ni lien, juste la salutation. */
export function WelcomeBanner({
  name,
  dogNames,
  roleMessage,
}: {
  name: string | null | undefined;
  dogNames?: (string | null | undefined)[];
  roleMessage?: string;
}) {
  const greeting = useGreeting({ name, dogNames, roleMessage });
  return (
    <section className="mb-4 rounded-xl border border-border bg-card px-5 py-4" aria-label="Bienvenue">
      <h2 className="font-display text-xl">{greeting.title}</h2>
      {greeting.lines.map((line) => (
        <p key={line} className="mt-1 text-sm text-muted-foreground">{line}</p>
      ))}
    </section>
  );
}
