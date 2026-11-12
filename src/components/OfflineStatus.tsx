import { useOnline } from '@/lib/offline';
import { WifiOff } from 'lucide-react';
export function OfflineStatus() {
  const online = useOnline();
  return online ? null : <p role="status" className="mb-4 flex gap-2 rounded-xl border border-border bg-secondary p-3 text-sm"><WifiOff className="size-5 shrink-0" aria-hidden />Vous êtes hors ligne. Ce qui a déjà été chargé reste consultable ; vos tampons seront confirmés dès le retour du réseau.</p>;
}