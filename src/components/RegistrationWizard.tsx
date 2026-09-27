import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHouseholds } from "@/lib/households";
import { DOG_POLICY_LABEL } from "@/lib/pro-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";

type Target = {
  activityId?: string;
  eventId?: string;
  title: string;
  dogPolicy: string;
  maxDogs: number | null;
  full: boolean;
  waitlist: boolean;
};

const STEPS = ["Foyer", "Qui participe ?", "Quel(s) chien(s) ?", "Informations", "Confirmation"];

export function RegistrationWizard({ open, onOpenChange, target }: { open: boolean; onOpenChange: (o: boolean) => void; target: Target }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: households = [] } = useMyHouseholds(user?.id);
  const [step, setStep] = useState(0);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [adults, setAdults] = useState<string[]>([]);
  const [kids, setKids] = useState<string[]>([]);
  const [dogs, setDogs] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const noDog = target.dogPolicy === "NONE";
  const maxDogs = target.maxDogs ?? (target.dogPolicy === "MULTIPLE" ? 99 : 1);
  const hh = households.find((h) => h.id === householdId) ?? null;

  useEffect(() => {
    if (!open) return;
    setStep(0); setResult(null); setNotes(""); setDogs([]); setKids([]);
    setAdults(user ? [user.id] : []);
    setHouseholdId(households[0]?.id ?? null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => STEPS.filter((s) => !(noDog && s === "Quel(s) chien(s) ?")), [noDog]);
  const current = steps[step];

  const toggle = (list: string[], set: (v: string[]) => void, id: string, limit = 99) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < limit) set([...list, id]);
    else toast.info(`Maximum ${limit} chien(s) pour cette activité.`);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("register_participation", {
        _activity_id: target.activityId ?? null,
        _event_id: target.eventId ?? null,
        _household_id: householdId,
        _user_ids: adults,
        _child_ids: kids,
        _dog_ids: noDog ? [] : dogs,
        _notes: notes,
      } as never);
      if (error) throw error;
      return (data as { status: string }).status;
    },
    onSuccess: (status) => {
      setResult(status);
      void qc.invalidateQueries({ queryKey: ["participations"] });
      void qc.invalidateQueries({ queryKey: ["spots"] });
      void qc.invalidateQueries({ queryKey: ["event-participations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canNext =
    current === "Qui participe ?" ? adults.length + kids.length > 0
    : current === "Quel(s) chien(s) ?" ? target.dogPolicy !== "REQUIRED" || dogs.length > 0
    : true;

  const check = (checked: boolean, onChange: () => void, label: string, key: string) => (
    <label key={key} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} /> {label}
    </label>
  );

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={`Je participe — ${target.title}`} description={result ? undefined : `Étape ${step + 1} sur ${steps.length} : ${current}`}>
      {result ? (
        <div className="space-y-3 text-sm" role="status">
          <CheckCircle2 className="size-10 text-primary" aria-hidden />
          <p className="font-display text-lg">{result === "WAITLIST" ? "Vous êtes sur liste d'attente" : "Inscription enregistrée"}</p>
          <p className="text-muted-foreground">
            {result === "WAITLIST" ? "Nous vous prévenons dès qu'une place se libère." : "Le Bureau confirmera votre inscription prochainement."}
          </p>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {current === "Foyer" ? (
            <>
              {households.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Vous pouvez vous inscrire seul·e. Pour inscrire d'autres personnes ou vos chiens, <Link to="/foyer" className="underline">créez votre foyer</Link>.
                </p>
              ) : null}
              {check(householdId === null, () => setHouseholdId(null), "Moi seul·e (sans foyer)", "none")}
              {households.map((h) => check(householdId === h.id, () => { setHouseholdId(h.id); setAdults(user ? [user.id] : []); setKids([]); setDogs([]); }, h.name, h.id))}
            </>
          ) : current === "Qui participe ?" ? (
            <>
              {(hh?.adults ?? [{ user_id: user!.id, name: "Moi", role: "ADMIN" }]).map((a) => check(adults.includes(a.user_id), () => toggle(adults, setAdults, a.user_id), a.name, a.user_id))}
              {(hh?.children ?? []).map((c) => check(kids.includes(c.id), () => toggle(kids, setKids, c.id), `${c.first_name} (enfant)`, c.id))}
              <p className="text-xs text-muted-foreground">Les enfants n'ont pas besoin de compte. Chaque personne compte pour une place.</p>
            </>
          ) : current === "Quel(s) chien(s) ?" ? (
            <>
              <p className="text-xs text-muted-foreground">{DOG_POLICY_LABEL[target.dogPolicy]}{target.maxDogs ? ` · ${target.maxDogs} maximum` : ""}</p>
              {(hh?.dogs ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucun chien dans ce foyer.</p> : null}
              {(hh?.dogs ?? []).map((d) => check(dogs.includes(d.id), () => toggle(dogs, setDogs, d.id, maxDogs), d.name, d.id))}
            </>
          ) : current === "Informations" ? (
            <div>
              <Label htmlFor="rw-notes">Informations complémentaires (facultatif)</Label>
              <Textarea id="rw-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergie, besoin particulier, question…" />
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p><strong>{adults.length + kids.length}</strong> personne(s){!noDog ? <>, <strong>{dogs.length}</strong> chien(s)</> : null}</p>
              {target.full ? <p className="text-muted-foreground">{target.waitlist ? "Complet : vous serez placé·e sur liste d'attente." : "Complet."}</p> : null}
            </div>
          )}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</Button>
            {step < steps.length - 1 ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Suivant</Button>
            ) : (
              <Button onClick={() => submit.mutate()} disabled={submit.isPending || (target.full && !target.waitlist)}>
                {submit.isPending ? "Envoi…" : "Confirmer"}
              </Button>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
