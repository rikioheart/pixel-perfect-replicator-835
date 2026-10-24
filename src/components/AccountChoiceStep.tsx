import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, Heart, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidSiret } from "@/lib/account-choice";

/** Première étape d'un compte en attente : choisir son parcours. Aucun droit n'est accordé ici. */
export function AccountChoiceStep({ onDone }: { onDone: () => Promise<void> }) {
  const [type, setType] = useState<"PARTICULIER" | "PROFESSIONNEL" | null>(null);
  const [pro, setPro] = useState({ company: "", siret: "", activity: "", description: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!type) return undefined;
    if (type === "PROFESSIONNEL") {
      if (pro.company.trim().length < 2) return toast.error("Indiquez le nom de votre structure.");
      if (pro.activity.trim().length < 2) return toast.error("Indiquez votre activité canine.");
      if (!isValidSiret(pro.siret)) return toast.error("Le SIRET doit comporter 14 chiffres.");
    }
    setSaving(true);
    const { error } = await supabase.rpc(
      "choose_account_type",
      type === "PROFESSIONNEL"
        ? { _type: type, _company: pro.company, _siret: pro.siret, _activity: pro.activity, _description: pro.description }
        : { _type: type },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Merci ! Votre demande est transmise au Bureau.");
    await onDone();
    return undefined;
  };

  const option = (value: "PARTICULIER" | "PROFESSIONNEL", Icon: typeof Heart, title: string, text: string) => (
    <button
      type="button"
      aria-pressed={type === value}
      onClick={() => setType(value)}
      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
        type === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
      }`}
    >
      <Icon className="size-5 text-primary" aria-hidden />
      <span className="font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </button>
  );

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Je rejoins l'association en tant que…</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ce choix oriente votre accueil. Il ne vous enferme pas : vous pourrez aussi participer à une activité
          comme particulier ou exercer une fonction associative plus tard.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {option("PARTICULIER", Heart, "Particulier", "Avec ou sans chien : activités, entraide, projets, carnet de votre compagnon.")}
          {option("PROFESSIONNEL", Briefcase, "Professionnel canin", "Éducateur, soins, pension… : fiche pro, partenariats et suivis partagés, après vérification par le Bureau.")}
        </div>

        {type === "PROFESSIONNEL" ? (
          <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="ac-company">Nom de la structure</Label>
              <Input id="ac-company" value={pro.company} onChange={(e) => setPro({ ...pro, company: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ac-activity">Activité canine</Label>
              <Input id="ac-activity" placeholder="Éducation, comportement, toilettage…" value={pro.activity} onChange={(e) => setPro({ ...pro, activity: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ac-siret">SIRET <span className="text-muted-foreground">(facultatif)</span></Label>
              <Input id="ac-siret" inputMode="numeric" value={pro.siret} onChange={(e) => setPro({ ...pro, siret: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ac-desc">Quelques mots <span className="text-muted-foreground">(facultatif)</span></Label>
              <Textarea id="ac-desc" rows={3} value={pro.description} onChange={(e) => setPro({ ...pro, description: e.target.value })} />
            </div>
          </div>
        ) : null}

        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Votre compte reste en attente jusqu'à la validation du Bureau. L'adhésion se règle sur HelloAsso, via le site de l'association.
        </p>
        <Button onClick={submit} disabled={!type || saving}>
          {saving ? "Envoi…" : "Valider mon choix"}
        </Button>
      </CardContent>
    </Card>
  );
}
