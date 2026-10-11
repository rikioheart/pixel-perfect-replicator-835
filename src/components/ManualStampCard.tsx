import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Stamp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/hooks/useAuth';
import { useOnline, readQueue, saveQueue, parisDay, canAutoSync, type PendingStamp } from '@/lib/offline';

type Opt = { id: string; name: string };

/** Attribution manuelle d'un tampon par un professionnel, avec information d'un membre du Bureau. */
export function ManualStampCard() {
  const { user } = useAuth();
  const online = useOnline();
  const [pending, setPending] = useState<PendingStamp[]>([]);
  const [cached, setCached] = useState<{members:Opt[];bureau:Opt[]}>();
  const [member, setMember] = useState("");
  const [bureau, setBureau] = useState("");
  const [reason, setReason] = useState("");
  const { data } = useQuery({
    queryKey: ["manual-stamp-options", user?.id],
    enabled: !!user && online,
    queryFn: async () => {
      const [m, b] = await Promise.all([supabase.rpc("list_particuliers"), supabase.rpc("list_bureau_members")]);
      if(m.error || b.error) throw new Error('Impossible de charger les personnes. Réessayez avec du réseau.');
      return { members: (m.data ?? []) as unknown as Opt[], bureau: (b.data ?? []) as unknown as Opt[] };
    },
  });
  useEffect(() => {
    if(!user) return;
    const refresh = () => setPending(readQueue(user.id));
    refresh();
    try { const saved = localStorage.getItem(`lvdc.offline.options.${user.id}`); if(saved) setCached(JSON.parse(saved)); } catch { /* no offline snapshot */ }
    window.addEventListener('lvdc-offline',refresh);
    return () => window.removeEventListener('lvdc-offline',refresh);
  },[user?.id]);
  useEffect(() => { if(data && user) { setCached(data); try {localStorage.setItem(`lvdc.offline.options.${user.id}`,JSON.stringify(data));}catch{/* No device cache */} } },[data,user?.id]);
  useEffect(() => {
    if(!online || !user) return;
    let cancelled = false;
    const sync = async () => {
      for(const item of readQueue(user.id)) {
        if(cancelled) break;
        if(!canAutoSync(item,user.id,parisDay())) continue;
        const {data:result,error} = await supabase.rpc('award_manual_stamp',{_member_id:item.member,_bureau_id:item.bureau,_reason:item.reason,_activity_id:null as unknown as string,_event_id:null as unknown as string});
        if(cancelled) break;
        if(error) {
          if(!navigator.onLine || !error.code) break;
          saveQueue(user.id,readQueue(user.id).map(i => i.id === item.id ? {...i,state:'review'} : i));
        } else {
          saveQueue(user.id,readQueue(user.id).filter(i => i.id !== item.id));
          toast.success((result as {awarded:boolean})?.awarded ? 'Tampon confirmé par le serveur, le Bureau est informé.' : 'Ce tampon était déjà enregistré.');
        }
      }
    };
    void sync();
    return () => { cancelled = true; };
  },[online,user?.id]);
  const award = useMutation({
    mutationFn: async () => {
      if (!member || !bureau) throw new Error("Choisissez le membre et le membre du Bureau à informer.");
      if (reason.trim().length < 3) throw new Error("Indiquez le motif.");
      if(!user) throw new Error('Connexion requise.');
      if(!navigator.onLine) {
        const items = readQueue(user.id);
        if(items.some(i => i.member === member && i.day === parisDay())) throw new Error('Une demande est déjà en attente pour cette personne aujourd’hui.');
        saveQueue(user.id,[...items,{id:crypto.randomUUID(),owner:user.id,member,bureau,reason:reason.trim(),day:parisDay(),state:'pending'}]);
        return {awarded:false,queued:true};
      }
      const { data: res, error } = await supabase.rpc("award_manual_stamp", {
        _member_id: member, _bureau_id: bureau, _reason: reason.trim(),
        _activity_id: null as unknown as string, _event_id: null as unknown as string,
      });
      if (error) throw error;
      return res as { awarded: boolean; message?: string; queued?: boolean };
    },
    onSuccess: (r) => {
      if(r.queued) { toast.info('Demande sauvegardée sur ce téléphone. Validation au retour du réseau.'); setReason(''); }
      else if (r.awarded) { toast.success("Tampon attribué, le Bureau est informé."); setReason(""); }
      else toast.info(r.message ?? "Tampon déjà attribué.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="panel space-y-3 p-4 text-sm">
      <h2 className="flex items-center gap-2 font-display text-lg"><Stamp className="size-4" aria-hidden /> Attribuer un tampon</h2>
      <p className="text-xs text-muted-foreground">Pour un membre particulier. Le membre du Bureau choisi reçoit une notification.</p>
      <Label htmlFor="ms-member">Membre</Label>
      <select id="ms-member" className="h-10 w-full rounded-md border border-input bg-background px-2" value={member} onChange={(e) => setMember(e.target.value)}>
        <option value="">Choisir…</option>
        {(data ?? cached)?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Label htmlFor="ms-bureau">Membre du Bureau à informer</Label>
      <select id="ms-bureau" className="h-10 w-full rounded-md border border-input bg-background px-2" value={bureau} onChange={(e) => setBureau(e.target.value)}>
        <option value="">Choisir…</option>
        {(data ?? cached)?.bureau.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Label htmlFor="ms-reason">Motif</Label>
      <Input id="ms-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. séance de suivi du 4 octobre" />
      <Button onClick={() => award.mutate()} disabled={award.isPending || (!data && !cached)}>{online ? 'Attribuer le tampon' : 'Garder la demande en attente'}</Button>
      {!online && <p className="text-sm text-muted-foreground">Le total ne change pas avant confirmation serveur. Reconnectez-vous le jour même ; sinon le Bureau devra vérifier la demande.</p>}
      {pending.length > 0 && <div role="status" className="space-y-2 rounded-xl border border-border bg-card p-3"><h3 className="font-medium">{pending.length} demande(s) en attente</h3>{pending.map(i => <div key={i.id} className="flex flex-wrap items-center justify-between gap-2"><p>{(data ?? cached)?.members.find(m => m.id === i.member)?.name ?? 'Adhérent'} · {i.day}<br /><span className="text-xs">{i.state === 'review' || i.day !== parisDay() ? 'À vérifier avec le Bureau : pas de nouvelle attribution automatique.' : 'En attente du retour du réseau.'}</span></p><Button variant="outline" size="sm" onClick={() => {if(user && window.confirm('Retirer cette demande locale ? Aucun tampon confirmé ne sera supprimé.')) saveQueue(user.id,readQueue(user.id).filter(x => x.id !== i.id));}}>Retirer</Button></div>)}</div>}
    </section>
  );
}
