import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { humanizeError } from "@/lib/user-messages";
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABEL,
  EMPTY_CONTACT,
  buildContactInsert,
  contactProblem,
  isOrganization,
  type ContactKind,
} from "@/lib/quick-contact";

const WHERE: Record<ContactKind, string> = {
  PARTICULIER: "Il est proposé dans les choix de personnes (matériel, comptabilité).",
  PROFESSIONNEL: "Il est proposé dans les choix de personnes (matériel, comptabilité).",
  PARTENAIRE: "Vous le retrouvez dans Partenaires & avantages.",
  MAIRIE: "Vous le retrouvez dans Mairies & institutions.",
};

/** Contact sans compte, créé par le Bureau depuis « Créer ». Aucun compte ni adhésion n'est créé. */
export function QuickContactDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ContactKind>("PARTICULIER");
  const [form, setForm] = useState(EMPTY_CONTACT);
  const org = isOrganization(kind);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const save = useMutation({
    mutationFn: async () => {
      const problem = contactProblem(kind, form);
      if (problem) throw new Error(problem);
      const ins = buildContactInsert(kind, form, user?.id ?? null);
      if (ins.table === "people") {
        if (ins.row.email) {
          const { data } = await supabase.from("people").select("id").ilike("email", ins.row.email).limit(1);
          if (data?.length) throw new Error("Une fiche existe déjà avec cet e-mail : inutile d'en créer une seconde.");
        }
        const { error } = await supabase.from("people").insert(ins.row);
        if (error) throw error;
      } else if (ins.table === "partners") {
        const { data } = await supabase.from("partners").select("id").ilike("name", ins.row.name).limit(1);
        if (data?.length) throw new Error("Ce partenaire est déjà enregistré.");
        const { error } = await supabase.from("partners").insert(ins.row);
        if (error) throw error;
      } else {
        const { data } = await supabase.from("mairies").select("id").ilike("organization", ins.row.organization).limit(1);
        if (data?.length) throw new Error("Cette structure est déjà enregistrée.");
        const { error } = await supabase.from("mairies").insert(ins.row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Contact ajouté.", { description: WHERE[kind] });
      void qc.invalidateQueries({ queryKey: ["partners"] });
      void qc.invalidateQueries({ queryKey: ["mairies"] });
      setForm(EMPTY_CONTACT);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(humanizeError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau contact</DialogTitle>
          <DialogDescription>Une simple fiche de contact : aucun compte n'est créé et la personne n'est pas prévenue.</DialogDescription>
        </DialogHeader>
        <form
          className="min-w-0 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Type de contact">
            {CONTACT_KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                role="radio"
                aria-checked={kind === k}
                variant={kind === k ? "default" : "outline"}
                onClick={() => setKind(k)}
              >
                {CONTACT_KIND_LABEL[k]}
              </Button>
            ))}
          </div>
          {org ? (
            <div className="space-y-1.5">
              <Label htmlFor="qc-org">Nom de la structure</Label>
              <Input id="qc-org" value={form.organization} onChange={set("organization")} autoFocus />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qc-first">Prénom</Label>
                <Input id="qc-first" value={form.firstName} onChange={set("firstName")} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qc-last">Nom</Label>
                <Input id="qc-last" value={form.lastName} onChange={set("lastName")} />
              </div>
            </div>
          )}
          {kind === "PROFESSIONNEL" ? (
            <div className="space-y-1.5">
              <Label htmlFor="qc-company">Structure (facultatif)</Label>
              <Input id="qc-company" value={form.organization} onChange={set("organization")} />
            </div>
          ) : null}
          {org ? (
            <div className="space-y-1.5">
              <Label htmlFor="qc-person">Interlocuteur (facultatif)</Label>
              <Input id="qc-person" value={form.contactPerson} onChange={set("contactPerson")} />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qc-email">E-mail (facultatif)</Label>
              <Input id="qc-email" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-phone">Téléphone (facultatif)</Label>
              <Input id="qc-phone" type="tel" value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          {kind !== "PARTENAIRE" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qc-city">Ville (facultatif)</Label>
                <Input id="qc-city" value={form.city} onChange={set("city")} />
              </div>
            </div>
          ) : null}
          {kind !== "PARTENAIRE" ? (
            <div className="space-y-1.5">
              <Label htmlFor="qc-notes">Note interne (facultatif)</Label>
              <Textarea id="qc-notes" rows={2} value={form.notes} onChange={set("notes")} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer le contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
