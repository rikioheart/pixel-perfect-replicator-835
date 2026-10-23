import { useEffect, useState } from 'react';
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}
export function parisDay(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export type PendingStamp = { id: string; owner: string; member: string; bureau: string; reason: string; day: string; state: 'pending' | 'review'; };
const key = (id: string) => `lvdc.offline.stamps.${id}`;
export function readQueue(id: string): PendingStamp[] { try { return JSON.parse(localStorage.getItem(key(id)) || '[]'); } catch { return []; } }
export function saveQueue(id: string, items: PendingStamp[]) { localStorage.setItem(key(id), JSON.stringify(items)); window.dispatchEvent(new Event('lvdc-offline')); }
export function canAutoSync(item: PendingStamp, owner: string, day: string) { return item.owner === owner && item.day === day && item.state === 'pending'; }
/** Demande d'un jour passé ou refusée par le serveur : jamais rejouée, seulement transmise au Bureau pour médiation. */
export function needsMediation(item: PendingStamp, owner: string, day: string) { return item.owner === owner && (item.state === 'review' || item.day < day); }

/** Copie locale du Pass Terrain : identifiant de carte et total confirmé à la sauvegarde, rien d'autre. */
export type OfflinePass = { owner: string; name: string; qr: string; code: string; total: number; savedAt: string };
export function readOfflinePass(owner: string): OfflinePass | null {
  try {
    const p = JSON.parse(localStorage.getItem('lvdc.offline.pass') || 'null') as OfflinePass | null;
    return p && p.owner === owner && typeof p.qr === 'string' && p.qr.startsWith('data:image/') ? p : null;
  } catch { return null; }
}

/** Partenaires publics (champs déjà publiés) pour la page de secours hors ligne. */
export function savePublicPros(pros: { name: string; sector?: string | null; specialties: string[]; city?: string | null }[]) {
  try {
    localStorage.setItem('lvdc.public.pros', JSON.stringify(pros.slice(0, 60).map(p => ({ display_name: p.name, specialties: [p.sector, ...p.specialties].filter(Boolean).slice(0, 3), public_city: p.city ?? '' }))));
  } catch { /* stockage indisponible */ }
}

export function clearPrivateOffline(id: string) {
  for (const k of [`lvdc.offline.stamps.${id}`, `lvdc.offline.options.${id}`, `lvdc.offline.role.${id}`, 'lvdc.offline.pass']) localStorage.removeItem(k);
}