import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { deleteMyAccount } from "@/lib/account-deletion.functions";
import { hasDeletionBlockers, type DeletionBlockers } from "@/lib/account-choice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AccountDeletionCard() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: blockers } = useQuery({
    queryKey: ["account-deletion-check"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_account_deletion_check");
      if (error) throw error;
      return data as unknown as DeletionBlockers;
    },
  });
  const blocked = hasDeletionBlockers(blockers);

  const run = async () => {
    setBusy(true);
    try {
      const res = await deleteMyAccount({ data: { confirm } });
      if (res.status === "BLOCKED") {
        toast.info("Le Bureau est prévenu : il vous aidera à transmettre vos responsabilités avant la clôture.");
        setOpen(false);
      } else {
        toast.success("Votre compte est clôturé. Merci pour votre présence dans l'association.");
        await signOut();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Paramètres du compte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Vous pouvez clôturer votre compte. Vos coordonnées sont alors effacées ; les traces financières et les
          comptes rendus que la loi impose de garder sont conservés, sans vos coordonnées.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 text-destructive">
              <Trash2 className="size-4" aria-hidden /> Supprimer mon compte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer mon compte</DialogTitle>
              <DialogDescription>Cette action est définitive : vous ne pourrez plus vous connecter avec ce compte.</DialogDescription>
            </DialogHeader>
            {blocked ? (
              <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
                <p>Avant de partir, quelques points sont à transmettre :</p>
                <ul className="list-disc pl-5">
                  {blockers!.projects.map((p) => (
                    <li key={p.id}>Vous êtes responsable du projet « {p.title} ».</li>
                  ))}
                  {blockers!.reimbursements > 0 ? <li>{blockers!.reimbursements} remboursement(s) non soldé(s).</li> : null}
                </ul>
                <p className="text-muted-foreground">En confirmant, le Bureau est prévenu pour réassigner ou solder ; votre compte reste ouvert d'ici là.</p>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="del-confirm">Tapez SUPPRIMER pour confirmer</Label>
              <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button variant="destructive" disabled={busy || confirm.trim().toUpperCase() !== "SUPPRIMER"} onClick={run}>
                {busy ? "Traitement…" : blocked ? "Prévenir le Bureau" : "Supprimer définitivement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
