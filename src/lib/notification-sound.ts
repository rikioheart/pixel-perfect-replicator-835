/**
 * Son de notification (préférence notification_sound) : deux notes douces générées par le navigateur,
 * sans fichier ni service externe. Joué une seule fois par notification, même si plusieurs zones
 * de l'écran suivent les notifications.
 */
const announced = new Set<string>();
let primed = false;

/**
 * Renvoie les notifications non lues jamais signalées. Au premier chargement, tout ce qui existe déjà
 * est considéré comme connu : seul ce qui arrive ensuite déclenche le son.
 */
export function newUnreadToChime(unreadIds: string[]): string[] {
  if (!primed) {
    unreadIds.forEach((id) => announced.add(id));
    primed = true;
    return [];
  }
  const fresh = unreadIds.filter((id) => !announced.has(id));
  fresh.forEach((id) => announced.add(id));
  return fresh;
}

/** Réinitialise le suivi (changement de compte, tests). */
export function resetChimeTracking() {
  announced.clear();
  primed = false;
}

type AudioContextCtor = typeof AudioContext;

/** Joue le son. Sans effet si le navigateur refuse l'audio (aucune interaction encore, par exemple). */
export function playNotificationChime() {
  if (typeof window === "undefined") return;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const start = ctx.currentTime;
    [660, 880].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = start + index * 0.16;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 800);
  } catch {
    // Audio indisponible : la notification reste visible, seul le son manque.
  }
}
