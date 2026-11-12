import { useCallback, useEffect, useState } from "react";
import { Stamp } from "lucide-react";
import { useUserPreferences } from "@/lib/user-preferences";
import { isNewStamp } from "@/lib/recognition";

/**
 * Petite célébration Or d'un tampon confirmé par le serveur : très brève, non bloquante,
 * sans mouvement si l'appareil ou la personne préfère les animations réduites (ou le mode épuré).
 * Désactivée par la préférence « Petites marques de reconnaissance ».
 */
export function StampCelebration({
  show,
  label,
  announce = false,
  onDone,
}: {
  show: boolean;
  label: string;
  /** true : annonce le texte aux lecteurs d'écran (pas de message éphémère déjà affiché). */
  announce?: boolean;
  onDone: () => void;
}) {
  const { preferences } = useUserPreferences();
  const enabled = preferences?.show_recognition !== false;
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(t);
  }, [show, onDone]);
  const visible = show && enabled;
  return (
    <>
      {announce ? (
        <span role="status" aria-live="polite" className="sr-only">{visible ? label : ""}</span>
      ) : null}
      {visible ? (
        <div className="stamp-celebration pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2" aria-hidden="true">
          <div className="pop inline-flex items-center gap-2 rounded-full border border-gold bg-gold-soft px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
            <span className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground">
              <span className="ring absolute inset-0 rounded-full" />
              <Stamp className="size-3.5" />
            </span>
            {label}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Repère un tampon confirmé depuis le dernier passage sur cet appareil (compteur serveur uniquement). */
export function useNewStampCelebration(userId: string | undefined, serverTotal: number | null | undefined) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!userId || serverTotal == null) return;
    const key = `lvdc.stamps-seen.${userId}`;
    try {
      if (isNewStamp(localStorage.getItem(key), serverTotal)) setShow(true);
      localStorage.setItem(key, String(serverTotal));
    } catch {
      /* pas de stockage : pas de célébration */
    }
  }, [userId, serverTotal]);
  const dismiss = useCallback(() => setShow(false), []);
  return { show, dismiss };
}
