import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Dog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHouseholds } from "@/lib/households";
import { defaultHouseholdName, firstStepsState, firstStepsStorageKey, type FirstStepsState } from "@/lib/first-steps";
import { couldNot, humanizeError } from "@/lib/user-messages";
import { DogEmptyArt } from "@/components/DogEmptyArt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

/** Données réelles du parcours, lues avec les droits de la personne connectée. */
export function useFirstSteps(isParticulier: boolean) {
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (!user?.id) return;
    try { setDismissed(window.localStorage.getItem(firstStepsStorageKey(user.id)) === "1"); } catch { setDismissed(false); }
  }, [user?.id]);

  const enabled = Boolean(user?.id) && isParticulier && profile?.membership_status === "ACTIVE";
  const { data, isLoading } = useQuery({
    queryKey: ["first-steps", user?.id],
    enabled,
    queryFn: async () => {
      const dogs = await supabase.from("dogs").select("id, name").eq("owner_id", user!.id).is("archived_at", null).order("created_at");
      return { dogs: dogs.data ?? [] };
    },
  });

  const state = firstStepsState({
    isParticulier,
    membershipStatus: profile?.membership_status,
    dogCount: data?.dogs.length ?? 0,
    dismissed,
  });
  const dismiss = () => {
    if (user?.id) { try { window.localStorage.setItem(firstStepsStorageKey(user.id), "1"); } catch { /* appareil sans stockage */ } }
    setDismissed(true);
  };
  return { state: { ...state, visible: state.visible && !isLoading && Boolean(data) }, data, dismiss };
}

/**
 * « Mon premier chien » : un petit pas pour le nouvel adhérent particulier,
 * présenter son compagnon. Rien n'est obligatoire.
 */
export function FirstStepsCard({ state, data, onDismiss }: {
  state: FirstStepsState;
  data: { dogs: { id: string; name: string }[] } | undefined;
  onDismiss: () => void;
}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: households = [] } = useMyHouseholds(user?.id);
  const [dog, setDog] = useState({ name: "", breed: "", birth_date: "" });
  const firstName = profile?.first_name ?? profile?.display_name ?? "";
  const household = households[0] ?? null;
  const dogName = data?.dogs[0]?.name ?? "";
  const percent = Math.round((state.doneCount / state.total) * 100);

  const addDog = useMutation({
    mutationFn: async () => {
      const name = dog.name.trim();
      if (name.length < 2) throw new Error("Indiquez le nom de votre compagnon (2 lettres au moins).");
      let householdId = household?.id ?? null;
      if (!householdId) {
        const { data: created, error } = await supabase.from("households")
          .insert({ name: defaultHouseholdName(profile?.first_name), created_by: user!.id }).select("id").single();
        if (error) throw error;
        householdId = created.id;
      }
      const { error } = await supabase.from("dogs").insert({
        owner_id: user!.id, household_id: householdId, name,
        breed: dog.breed.trim() || null, birth_date: dog.birth_date || null,
      });
      if (error) throw error;
      return name;
    },
    onSuccess: async (name) => {
      toast.success(`Bienvenue à ${name} ! Sa fiche est prête.`);
      setDog({ name: "", breed: "", birth_date: "" });
      await Promise.all(["first-steps", "my-dogs", "my-dog-home", "my-households", "orphan-dogs", "home-dog-names"]
        .map((key) => qc.invalidateQueries({ queryKey: [key] })));
    },
    onError: (e: Error) => toast.error(humanizeError(e, couldNot("enregistrer votre compagnon"))),
  });

  return (
    <section className="panel overflow-hidden" aria-labelledby="first-steps-title">
      <div className="flex flex-wrap items-center gap-4 p-5 pb-3">
        <DogEmptyArt art="playful" className="hidden h-auto w-28 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 id="first-steps-title" className="font-display text-xl">
            {firstName ? `Bienvenue parmi nous, ${firstName} !` : "Bienvenue parmi nous !"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un petit pas pour bien commencer, à votre rythme. Rien n'est obligatoire.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={percent} className="max-w-48" aria-label={`Premiers pas : ${state.doneCount} sur ${state.total}`} />
            <span className="text-xs text-muted-foreground">{state.doneCount} sur {state.total}</span>
          </div>
        </div>
      </div>

      <ol className="grid gap-3 p-5 pt-2">
        <li className="rounded-lg border border-border bg-card p-4">
          <StepTitle done={state.dogDone} number={1} icon={<Dog className="size-4" aria-hidden />}>
            Présenter mon compagnon
          </StepTitle>
          {state.dogDone ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {dogName ? `${dogName} fait désormais partie de la famille de l'association.` : "Votre compagnon est bien enregistré."}{" "}
              Vous retrouverez sa fiche juste en dessous.
            </p>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); addDog.mutate(); }}>
              <div>
                <Label htmlFor="fs-dog-name">Son nom</Label>
                <Input id="fs-dog-name" value={dog.name} autoComplete="off" required minLength={2}
                  onChange={(e) => setDog({ ...dog, name: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="fs-dog-breed">Race ou type (facultatif)</Label>
                  <Input id="fs-dog-breed" value={dog.breed} placeholder="Croisé, berger…"
                    onChange={(e) => setDog({ ...dog, breed: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="fs-dog-birth">Date de naissance (facultatif)</Label>
                  <Input id="fs-dog-birth" type="date" value={dog.birth_date}
                    onChange={(e) => setDog({ ...dog, birth_date: e.target.value })} />
                </div>
              </div>
              {!household ? (
                <p className="text-xs text-muted-foreground">
                  Nous créons aussi votre foyer, pour pouvoir l'inscrire aux sorties. Vous pourrez le compléter dans « Mon foyer ».
                </p>
              ) : null}
              <Button type="submit" size="sm" disabled={addDog.isPending}>
                {addDog.isPending ? "Enregistrement…" : "Présenter mon chien"}
              </Button>
            </form>
          )}
        </li>
      </ol>

      <div className="flex justify-end px-5 pb-4">
        <Button variant="ghost" size="sm" onClick={onDismiss}>Je regarderai plus tard</Button>
      </div>
    </section>
  );
}

function StepTitle({ done, number, icon, children }: { done: boolean; number: number; icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
        aria-hidden
      >
        {done ? <Check className="size-3.5" /> : number}
      </span>
      {icon}
      <span>{children}</span>
      {done ? <span className="sr-only">(fait)</span> : null}
    </h3>
  );
}
