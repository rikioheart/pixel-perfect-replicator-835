import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, RotateCcw } from "lucide-react";
import { FirstStepsView } from "@/components/FirstStepsCard";
import { DEMO_ACTIVITY, DEMO_PERSONA, demoAddDog, demoRegister, demoStepsState, initialDemo } from "@/lib/first-steps-demo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Démonstration sécurisée du parcours d'accueil, réservée au Bureau.
 * Compte d'essai fictif, tout en mémoire : rien n'est lu ni écrit dans les données réelles.
 */
export function FirstStepsDemo() {
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState(initialDemo);
  const [activityDate, setActivityDate] = useState<string | null>(null);
  const state = demoStepsState(demo);

  const reset = () => {
    setDemo(initialDemo());
    setActivityDate(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString());
  };
  const onOpenChange = (next: boolean) => {
    if (next) reset();
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FlaskConical aria-hidden /> Essayer le parcours d'accueil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Démonstration : « Mon premier chien & sortie »</DialogTitle>
          <DialogDescription>
            Vous voyez l'accueil de {DEMO_PERSONA.firstName}, {DEMO_PERSONA.label.toLowerCase()} : adhésion active, sans chien
            ni sortie. Rien n'est enregistré et personne n'est prévenu ; fermer cette fenêtre efface tout.
          </DialogDescription>
        </DialogHeader>

        {state.visible ? (
          <FirstStepsView
            state={state}
            firstName={DEMO_PERSONA.firstName}
            dogName={demo.dogs[0]?.name ?? ""}
            hasHousehold={demo.householdCreated}
            next={{ ...DEMO_ACTIVITY, date: activityDate }}
            addingDog={false}
            onAddDog={async (draft) => {
              const result = demoAddDog(demo, draft);
              if (!result.ok) { toast.error(result.message); return false; }
              setDemo(result.state);
              toast.success(`Bienvenue à ${draft.name.trim()} ! (démonstration : rien n'est enregistré)`);
              return true;
            }}
            outingActions={
              <>
                <Button size="sm" onClick={() => {
                  const result = demoRegister(demo);
                  if (!result.ok) { toast.error(result.message); return; }
                  setDemo(result.state);
                  toast.success("Inscription simulée : rien n'a été enregistré.");
                }}>
                  M'inscrire (essai)
                </Button>
                <p className="w-full text-xs text-muted-foreground">
                  Pour un vrai membre, ce bouton ouvre la page de la sortie et son inscription habituelle.
                </p>
              </>
            }
            outingDoneText="Inscription simulée. Pour un vrai membre, le Bureau confirmerait sa place."
            onDismiss={() => setDemo({ ...demo, dismissed: true })}
          />
        ) : (
          <div className="panel space-y-2 p-5 text-sm">
            <p className="font-medium">
              {demo.dismissed
                ? "La personne a choisi « Je regarderai plus tard » : la carte est masquée sur son appareil."
                : `Les deux étapes sont faites : la carte disparaît de l'accueil de ${DEMO_PERSONA.firstName}.`}
            </p>
            <p className="text-muted-foreground">Aucune donnée réelle n'a été touchée.</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden /> Recommencer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
