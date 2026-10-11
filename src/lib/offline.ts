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
export function clearPrivateOffline(id: string) {
  for (const k of [`lvdc.offline.stamps.${id}`, `lvdc.offline.options.${id}`, 'lvdc.offline.pass']) localStorage.removeItem(k);
}