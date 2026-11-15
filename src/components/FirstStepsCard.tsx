import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyHouseholds } from "@/lib/households";
import { defaultHouseholdName, firstStepsState, firstStepsStorageKey, type FirstStepsState } from "@/lib/first-steps";
import { couldNot, humanizeError } from "@/lib/user-messages";
import { DogEmptyArt } from "@/components/DogEmptyArt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const reopen = () => {
    if (user?.id) { try { window.localStorage.removeItem(firstStepsStorageKey(user.id)); } catch { /* appareil sans stockage */ } }
    setDismissed(false);
  };
  const ready = !isLoading && Boolean(data);
  return {
    state: { ...state, visible: state.visible && ready, display: ready ? state.display : "hidden" as const },
    data, dismiss, reopen,
  };
}

/**
 * « Mon premier chien » : un petit pas pour le nouvel adhérent particulier,
 * présenter son compagnon. Rien n'est obligatoire.
 */
/**
 * « Mon premier chien » : une invitation courte, avec le formulaire d'ajout
 * directement ouvert. Après « Plus tard », un rappel discret permet d'y revenir.
 */
export function FirstStepsCard({ state, onDismiss, onReopen }: {
  state: FirstStepsState;
  onDismiss: () => void;
  onReopen: () => void;
}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: households = [] } = useMyHouseholds(user?.id);
  const [dog, setDog] = useState({ name: "", breed: "", birth_date: "" });
  const [focusName, setFocusName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const firstName = profile?.first_name ?? profile?.display_name ?? "";
  const household = households[0] ?? null;

  useEffect(() => {
    if (focusName && state.display === "full") { nameRef.current?.focus(); setFocusName(false); }
  }, [focusName, state.display]);

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

  if (state.display === "reminder") {
    return (
      <section className="panel flex flex-wrap items-center gap-3 p-4" aria-label="Présenter mon compagnon">
        <Dog className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Quand vous le souhaitez, présentez-nous votre compagnon.
        </p>
        <Button size="sm" variant="outline" onClick={() => { onReopen(); setFocusName(true); }}>
          Présenter mon compagnon
        </Button>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden" aria-labelledby="first-steps-title">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <DogEmptyArt art="playful" className="hidden h-auto w-24 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 id="first-steps-title" className="font-display text-xl">
            {firstName ? `Bienvenue parmi nous, ${firstName} !` : "Bienvenue parmi nous !"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Présentez-nous votre compagnon : son nom suffit pour commencer.
          </p>

          <form className="mt-4 space-y-3" aria-label="Présenter mon compagnon"
            onSubmit={(e) => { e.preventDefault(); addDog.mutate(); }}>
            <div>
              <Label htmlFor="fs-dog-name">Son nom</Label>
              <Input id="fs-dog-name" ref={nameRef} value={dog.name} autoComplete="off" required minLength={2}
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
              <p className="text-xs text-muted-foreground">Votre foyer sera créé en même temps ; vous pourrez le compléter plus tard.</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={addDog.isPending}>
                {addDog.isPending ? "Enregistrement…" : "Présenter mon chien"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>Plus tard</Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
