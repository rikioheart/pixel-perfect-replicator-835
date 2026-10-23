import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ClipboardPaste, Stamp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/hooks/useAuth';
import { useOnline, readQueue, saveQueue, parisDay, canAutoSync, needsMediation, type PendingStamp } from '@/lib/offline';
import { normalizePassInput } from "@/lib/pass-code";
import { PassScanner } from "@/components/PassScanner";

type Opt = { id: string; name: string };
type Identified = { id: string; name: string; total: number; type: string; status: string };

/** Validation d'un Pass Terrain par un professionnel : caméra, collage ou saisie, puis tampon serveur. */
export function ManualStampCard() {
  const { user } = useAuth();
  const online = useOnline();
  const [pending, setPending] = useState<PendingStamp[]>([]);
  const [cached, setCached] = useState<{members:Opt[];bureau:Opt[]}>();
  const [member, setMember] = useState("");
  const [bureau, setBureau] = useState("");
  const [reason, setReason] = useState("");
  const [scanning, setScanning] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [identified, setIdentified] = useState<Identified | null>(null);
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
  const [mediating, setMediating] = useState<string | null>(null);
  /** Demande d'un jour passé ou refusée : transmise au Bureau, jamais transformée en tampon automatiquement. */
  const mediate = async (item: PendingStamp) => {
    if (!user) return;
    if (!navigator.onLine) { toast.info('Reconnectez-vous pour transmettre la demande au Bureau.'); return; }
    setMediating(item.id);
    const { data: res, error } = await supabase.rpc('submit_offline_stamp_mediation', { _local_id: item.id, _member_id: item.member, _bureau_id: item.bureau, _reason: item.reason, _offline_day: item.day });
    setMediating(null);
    if (error) { toast.error(error.message); return; }
    saveQueue(user.id, readQueue(user.id).filter(i => i.id !== item.id));
    toast.success((res as { submitted?: boolean })?.submitted ? 'Demande transmise au Bureau pour médiation. Aucun tampon n’est ajouté avant sa décision.' : 'Cette demande avait déjà été transmise au Bureau.');
  };
  const blocked = identified && identified.id === member && (identified.status !== 'ACTIVE' || identified.type !== 'PARTICULIER');
  const resolve = async (raw: string) => {
    setScanning(false);
    const code = normalizePassInput(raw);
    if (!code) { toast.error("Ce code ne ressemble pas à un Pass Terrain."); return; }
    if (!navigator.onLine) { toast.info("Sans réseau, le pass ne peut pas être vérifié : choisissez la personne dans la liste."); return; }
    setResolving(true);
    const { data: res, error } = await supabase.rpc("resolve_member_from_qr", { _scanned_code: code });
    setResolving(false);
    if (error) { toast.error(error.message); return; }
    const r = res as { found: boolean; reason?: string; member_id?: string; display_name?: string; total_stamps?: number; membership_type?: string; membership_status?: string };
    if (!r.found) {
      toast.error(r.reason === "AMBIGUOUS" ? "Plusieurs pass correspondent : scannez le QR ou saisissez le code complet." : "Aucun pass ne correspond à ce code.");
      return;
    }
    setIdentified({ id: r.member_id!, name: r.display_name ?? "Adhérent", total: r.total_stamps ?? 0, type: r.membership_type ?? "", status: r.membership_status ?? "" });
    setMember(r.member_id!);
    setCodeInput("");
  };
  const paste = async () => {
    try { const text = await navigator.clipboard.readText(); if (text) { setCodeInput(text); void resolve(text); } else toast.info("Le presse-papier est vide."); }
    catch { toast.info("Collage automatique refusé : collez le code dans le champ."); }
  };

  return (
    <section className="panel space-y-3 p-4 text-sm" aria-labelledby="ms-title">
      <h2 id="ms-title" className="flex items-center gap-2 font-display text-lg"><Stamp className="size-4" aria-hidden /> Valider un Pass Terrain</h2>
      <p className="text-xs text-muted-foreground">Scannez le pass d'un membre particulier, collez ou saisissez son code. Le membre du Bureau choisi est informé.</p>

      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div role="tablist" aria-label="Mode de lecture du pass" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button type="button" role="tab" aria-selected={!scanning} onClick={() => setScanning(false)} className={`rounded-md px-3 py-2 text-sm font-medium ${!scanning ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Saisir le code</button>
          <button type="button" role="tab" aria-selected={scanning} disabled={!online} onClick={() => setScanning(true)} className={`flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${scanning ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Camera className="size-4" aria-hidden /> Scanner</button>
        </div>
        {scanning ? (
          <PassScanner onResult={(t) => { setScanning(false); void resolve(t); }} onClose={() => setScanning(false)} onUnavailable={() => { setScanning(false); toast.info("Caméra indisponible : saisissez ou collez le code."); }} />
        ) : (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void resolve(codeInput); }}>
            <Label htmlFor="ms-code">Code du pass</Label>
            <div className="flex gap-2">
              <Input id="ms-code" autoFocus value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="ex. 7B29-C4E1" autoComplete="off" autoCapitalize="characters" inputMode="text" className="font-mono tracking-wider" />
              <Button type="button" variant="outline" onClick={() => void paste()} disabled={!online} aria-label="Coller le code"><ClipboardPaste className="size-4" aria-hidden /><span className="hidden sm:inline">Coller</span></Button>
            </div>
            <Button type="submit" className="w-full" disabled={!codeInput.trim() || resolving || !online}>{resolving ? "Vérification…" : "Vérifier le pass"}</Button>
          </form>
        )}
        {identified && identified.id === member && (
          <div role="status" className="rounded-lg bg-muted p-3">
            <p className="font-medium">{identified.name}</p>
            <p className="text-xs text-muted-foreground">
              {identified.total % 10}/10 tampons sur la carte en cours
              {identified.status !== "ACTIVE" ? " · adhésion pas encore validée par le Bureau : tampon possible après validation" : ""}
              {identified.type !== "PARTICULIER" ? " · les tampons manuels sont réservés aux particuliers" : ""}
            </p>
          </div>
        )}
      </div>

      <Label htmlFor="ms-member">Ou choisir dans la liste</Label>
      <select id="ms-member" className="h-10 w-full rounded-md border border-input bg-background px-2" value={member} onChange={(e) => { setMember(e.target.value); setIdentified(null); }}>
        <option value="">Choisir…</option>
        {identified && !(data ?? cached)?.members.some((m) => m.id === identified.id) && <option value={identified.id}>{identified.name}</option>}
        {(data ?? cached)?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Label htmlFor="ms-bureau">Membre du Bureau à informer</Label>
      <select id="ms-bureau" className="h-10 w-full rounded-md border border-input bg-background px-2" value={bureau} onChange={(e) => setBureau(e.target.value)}>
        <option value="">Choisir…</option>
        {(data ?? cached)?.bureau.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Label htmlFor="ms-reason">Motif</Label>
      <Input id="ms-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. séance de suivi du 4 octobre" />
      <Button onClick={() => award.mutate()} disabled={award.isPending || (!data && !cached) || Boolean(blocked)}>{online ? 'Attribuer le tampon' : 'Garder la demande en attente'}</Button>
      {!online && <p className="text-sm text-muted-foreground">Le total ne change pas avant confirmation serveur. Reconnectez-vous le jour même ; sinon vous pourrez transmettre la demande au Bureau pour médiation.</p>}
      {pending.length > 0 && (
        <div role="status" className="space-y-2 rounded-xl border border-border bg-card p-3">
          <h3 className="font-medium">{pending.length} demande(s) en attente</h3>
          {pending.map(i => {
            const toBureau = user ? needsMediation(i, user.id, parisDay()) : false;
            return (
              <div key={i.id} className="space-y-2 border-t border-border pt-2 first:border-0 first:pt-0">
                <p>{(data ?? cached)?.members.find(m => m.id === i.member)?.name ?? 'Adhérent'} · {i.day}<br /><span className="text-xs text-muted-foreground">{toBureau ? 'Pas d’attribution automatique : le Bureau peut examiner cette demande.' : 'En attente du retour du réseau.'}</span></p>
                <div className="flex flex-wrap gap-2">
                  {toBureau && <Button size="sm" onClick={() => void mediate(i)} disabled={!online || mediating === i.id}>{mediating === i.id ? 'Envoi…' : 'Transmettre au Bureau pour médiation'}</Button>}
                  <Button variant="outline" size="sm" onClick={() => {if(user && window.confirm('Retirer cette demande locale ? Aucun tampon confirmé ne sera supprimé.')) saveQueue(user.id,readQueue(user.id).filter(x => x.id !== i.id));}}>Retirer</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
