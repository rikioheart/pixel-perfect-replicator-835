import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Dog, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHouseholds } from "@/lib/households";
import { formatDate } from "@/lib/domain";
import { countOutings, defaultHouseholdName, dogNameProblem, firstStepsState, firstStepsStorageKey, type DogDraft, type FirstStepsState } from "@/lib/first-steps";
import { couldNot, humanizeError } from "@/lib/user-messages";
import { DogEmptyArt } from "@/components/DogEmptyArt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export type NextActivity = { id: string; title: string; date: string | null; location: string | null };

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
      const nowIso = new Date().toISOString();
      const [dogs, parts, next] = await Promise.all([
        supabase.from("dogs").select("id, name").eq("owner_id", user!.id).is("archived_at", null).order("created_at"),
        supabase.from("participations").select("registration_status").eq("user_id", user!.id),
        supabase.from("activities").select("id, title, date, location").gte("date", nowIso)
          .not("status", "in", "(DRAFT,CANCELLED)").order("date", { ascending: true }).limit(1),
      ]);
      return {
        dogs: dogs.data ?? [],
        outingCount: countOutings((parts.data ?? []).map((p) => p.registration_status)),
        next: ((next.data ?? [])[0] ?? null) as NextActivity | null,
      };
    },
  });

  const state = firstStepsState({
    isParticulier,
    membershipStatus: profile?.membership_status,
    dogCount: data?.dogs.length ?? 0,
    outingCount: data?.outingCount ?? 0,
    dismissed,
  });
  const dismiss = () => {
    if (user?.id) { try { window.localStorage.setItem(firstStepsStorageKey(user.id), "1"); } catch { /* appareil sans stockage */ } }
    setDismissed(true);
  };
  return { state: { ...state, visible: state.visible && !isLoading && Boolean(data) }, data, dismiss };
}

/**
 * « Mon premier chien & sortie » : deux petits pas pour le nouvel adhérent particulier,
 * présenter son compagnon puis découvrir sa première sortie. Aucune étape n'est obligatoire.
 * Version réelle : écrit dans la base avec les droits de la personne connectée.
 */
export function FirstStepsCard({ state, data, onDismiss }: {
  state: FirstStepsState;
  data: { dogs: { id: string; name: string }[]; next: NextActivity | null } | undefined;
  onDismiss: () => void;
}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: households = [] } = useMyHouseholds(user?.id);
  const household = households[0] ?? null;

  const addDog = useMutation({
    mutationFn: async (dog: DogDraft) => {
      const problem = dogNameProblem(dog.name);
      if (problem) throw new Error(problem);
      const name = dog.name.trim();
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
      await Promise.all(["first-steps", "my-dogs", "my-dog-home", "my-households", "orphan-dogs", "home-dog-names"]
        .map((key) => qc.invalidateQueries({ queryKey: [key] })));
    },
    onError: (e: Error) => toast.error(humanizeError(e, couldNot("enregistrer votre compagnon"))),
  });

  const next = data?.next ?? null;
  return (
    <FirstStepsView
      state={state}
      firstName={profile?.first_name ?? profile?.display_name ?? ""}
      dogName={data?.dogs[0]?.name ?? ""}
      hasHousehold={Boolean(household)}
      next={next}
      addingDog={addDog.isPending}
      onAddDog={(dog) => addDog.mutateAsync(dog).then(() => true, () => false)}
      outingActions={next ? (
        <>
          <Button asChild size="sm">
            <Link to="/activities/$activityId" params={{ activityId: next.id }}>Découvrir et m'inscrire</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/activities">Voir toutes les sorties</Link>
          </Button>
        </>
      ) : null}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Affichage commun du parcours, partagé par la version réelle et la démonstration
 * pour que le Bureau voie exactement ce que verra un nouvel adhérent.
 */
export function FirstStepsView({
  state, firstName, dogName, hasHousehold, next, addingDog, onAddDog, outingActions, onDismiss,
  dismissLabel = "Je regarderai plus tard", outingDoneText = "Votre première inscription est enregistrée. Le Bureau vous confirmera votre place.",
}: {
  state: FirstStepsState;
  firstName: string;
  dogName: string;
  hasHousehold: boolean;
  next: NextActivity | null;
  addingDog: boolean;
  /** Renvoie true quand le chien est enregistré, pour vider le formulaire. */
  onAddDog: (dog: DogDraft) => Promise<boolean>;
  outingActions: ReactNode;
  onDismiss: () => void;
  dismissLabel?: string;
  outingDoneText?: string;
}) {
  const [dog, setDog] = useState<DogDraft>({ name: "", breed: "", birth_date: "" });
  const percent = Math.round((state.doneCount / state.total) * 100);
  const submit = async () => {
    if (await onAddDog(dog)) setDog({ name: "", breed: "", birth_date: "" });
  };

  return (
    <section className="panel overflow-hidden" aria-labelledby="first-steps-title">
      <div className="flex flex-wrap items-center gap-4 p-5 pb-3">
        <DogEmptyArt art="playful" className="hidden h-auto w-28 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 id="first-steps-title" className="font-display text-xl">
            {firstName ? `Bienvenue parmi nous, ${firstName} !` : "Bienvenue parmi nous !"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deux petits pas pour bien commencer, à votre rythme. Rien n'est obligatoire.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={percent} className="max-w-48" aria-label={`Premiers pas : ${state.doneCount} sur ${state.total}`} />
            <span className="text-xs text-muted-foreground">{state.doneCount} sur {state.total}</span>
          </div>
        </div>
      </div>

      <ol className="grid gap-3 p-5 pt-2 md:grid-cols-2">
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
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
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
              {!hasHousehold ? (
                <p className="text-xs text-muted-foreground">
                  Nous créons aussi votre foyer, pour pouvoir l'inscrire aux sorties. Vous pourrez le compléter dans « Mon foyer ».
                </p>
              ) : null}
              <Button type="submit" size="sm" disabled={addingDog}>
                {addingDog ? "Enregistrement…" : "Présenter mon chien"}
              </Button>
            </form>
          )}
        </li>

        <li className="rounded-lg border border-border bg-card p-4">
          <StepTitle done={state.outingDone} number={2} icon={<CalendarDays className="size-4" aria-hidden />}>
            Ma première sortie
          </StepTitle>
          {state.outingDone ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {outingDoneText}
            </p>
          ) : next ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-muted-foreground">
                {dogName ? `Une belle occasion de rencontrer d'autres binômes avec ${dogName} :` : "Une belle occasion de faire connaissance :"}
              </p>
              <div className="rounded-md bg-secondary/60 p-3">
                <p className="font-medium">{next.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(next.date)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" aria-hidden />{next.location ?? "Lieu précisé bientôt"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">{outingActions}</div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune sortie n'est ouverte pour l'instant. Elles apparaîtront ici dès leur ouverture, nous avons hâte de vous y retrouver.
            </p>
          )}
        </li>
      </ol>

      <div className="flex justify-end px-5 pb-4">
        <Button variant="ghost" size="sm" onClick={onDismiss}>{dismissLabel}</Button>
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
