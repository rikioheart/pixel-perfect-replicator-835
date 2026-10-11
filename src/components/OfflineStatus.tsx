import { useOnline } from '@/lib/offline';
import { WifiOff } from 'lucide-react';
export function OfflineStatus() {
  const online = useOnline();
  return online ? null : <p role="status" className="mb-4 flex gap-2 rounded-xl border border-border bg-secondary p-3 text-sm"><WifiOff className="size-5 shrink-0" aria-hidden />Sans réseau : seules les informations sauvegardées sont disponibles. Les tampons attendent la validation du serveur.</p>;
}