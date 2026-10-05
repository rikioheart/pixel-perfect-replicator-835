import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Stamp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Opt = { id: string; name: string };

/** Attribution manuelle d'un tampon par un professionnel, avec information d'un membre du Bureau. */
export function ManualStampCard() {
  const [member, setMember] = useState("");
  const [bureau, setBureau] = useState("");
  const [reason, setReason] = useState("");
  const { data } = useQuery({
    queryKey: ["manual-stamp-options"],
    queryFn: async () => {
      const [m, b] = await Promise.all([supabase.rpc("list_particuliers"), supabase.rpc("list_bureau_members")]);
      return { members: (m.data ?? []) as unknown as Opt[], bureau: (b.data ?? []) as unknown as Opt[] };
    },
  });
  const award = useMutation({
    mutationFn: async () => {
      if (!member || !bureau) throw new Error("Choisissez le membre et le membre du Bureau à informer.");
      if (reason.trim().length < 3) throw new Error("Indiquez le motif.");
      const { data: res, error } = await supabase.rpc("award_manual_stamp", {
        _member_id: member, _bureau_id: bureau, _reason: reason.trim(),
        _activity_id: null as unknown as string, _event_id: null as unknown as string,
      });
      if (error) throw error;
      return res as { awarded: boolean; message?: string };
    },
    onSuccess: (r) => {
      if (r.awarded) { toast.success("Tampon attribué, le Bureau est informé."); setReason(""); }
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
        {data?.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Label htmlFor="ms-bureau">Membre du Bureau à informer</Label>
      <select id="ms-bureau" className="h-10 w-full rounded-md border border-input bg-background px-2" value={bureau} onChange={(e) => setBureau(e.target.value)}>
        <option value="">Choisir…</option>
        {data?.bureau.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Label htmlFor="ms-reason">Motif</Label>
      <Input id="ms-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. séance de suivi du 4 octobre" />
      <Button onClick={() => award.mutate()} disabled={award.isPending}>Attribuer le tampon</Button>
    </section>
  );
}
