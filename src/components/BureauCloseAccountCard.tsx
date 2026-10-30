import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserX } from "lucide-react";
import { closeMemberAccount } from "@/lib/account-deletion.functions";
import { canSubmitAccountClosure } from "@/lib/household-people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Départ sans démarche du membre : le Bureau clôture le compte, avec motif et confirmation. */
export function BureauCloseAccountCard({ memberId, memberName }: { memberId: string; memberName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await closeMemberAccount({ data: { profileId: memberId, reason: reason.trim(), confirm } });
      if (r.status === "ALREADY_CLOSED") toast.info("Ce compte était déjà clôturé.");
      else {
        const extra = r.openReimbursements ? ` ${r.openReimbursements} remboursement(s) restent à solder.` : "";
        toast.success(`Compte clôturé. Projets repris par vous : ${r.projects}, tâches libérées : ${r.tasks}, chiens archivés : ${r.dogs}.${extra}`);
      }
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["member", memberId] });
      void qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clôture impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel space-y-3 p-5" aria-labelledby="close-account-title">
      <h2 id="close-account-title" className="text-lg">Départ de l'association</h2>
      <p className="text-sm text-muted-foreground">
        Si {memberName} est parti·e sans clôturer son compte (sans nouvelles ou après un désaccord), le Bureau peut le faire à sa place.
      </p>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setReason(""); setConfirm(""); } }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 text-destructive"><UserX className="size-4" aria-hidden /> Clôturer ce compte</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer le compte de {memberName}</DialogTitle>
            <DialogDescription>Action définitive, inscrite au journal du Bureau.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>La connexion est coupée et le statut passe à « Radié·e ».</li>
            <li>Ses projets en cours vous reviennent, ses tâches sont libérées.</li>
            <li>Ses chiens sont archivés et les partages avec des pros retirés.</li>
            <li>Nom, coordonnées et présentation sont effacés.</li>
            <li>Les remboursements, la comptabilité et les comptes rendus sont conservés.</li>
          </ul>
          <div className="space-y-1">
            <Label htmlFor="close-reason">Motif (obligatoire, visible du Bureau seulement)</Label>
            <Textarea id="close-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. départ sans nouvelles depuis un an" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="close-confirm">Tapez CLÔTURER pour confirmer</Label>
            <Input id="close-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={busy || !canSubmitAccountClosure(reason, confirm)} onClick={run}>Clôturer le compte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
