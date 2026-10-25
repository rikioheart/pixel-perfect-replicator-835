import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, QrCode, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { canToggleValidator, hasPersonalPass, needsPersonalPassActivation, validatorSource, type PassAccess } from "@/lib/pass-access";

export const PASS_ACCESS_KEY = ["pass-access"] as const;

export async function fetchPassAccess(): Promise<PassAccess> {
  const { data, error } = await supabase.rpc("my_pass_access");
  if (error) throw error;
  return data as unknown as PassAccess;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }) : "");

/** Écran d'activation : mon pass personnel et mon statut valideur, pour les comptes Bureau ou pro. */
export function PassAccessPanel({ access }: { access: PassAccess }) {
  const queryClient = useQueryClient();
  const [rulesRead, setRulesRead] = useState(false);
  const source = validatorSource(access);

  const run = useMutation({
    mutationFn: async (input: { kind: "pass" | "validator"; active: boolean }) => {
      const { error } = input.kind === "pass"
        ? await supabase.rpc("set_personal_pass", { _active: input.active })
        : await supabase.rpc("set_pass_validator", { _active: input.active });
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      void queryClient.invalidateQueries({ queryKey: PASS_ACCESS_KEY });
      setRulesRead(false);
      if (input.kind === "pass" && !input.active) {
        try { localStorage.removeItem("lvdc.offline.pass"); } catch { /* stockage indisponible */ }
      }
      toast.success(input.kind === "pass"
        ? (input.active ? "Votre pass personnel est activé." : "Votre pass personnel est désactivé.")
        : (input.active ? "Vous pouvez maintenant valider les pass des membres." : "Statut valideur suspendu."));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action impossible."),
  });

  return (
    <section aria-labelledby="pass-access-title" className="mb-4 grid gap-4 md:grid-cols-2">
      <h2 id="pass-access-title" className="sr-only">Accès au Pass Terrain</h2>

      <div className="panel space-y-3 p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg"><QrCode className="size-4" aria-hidden /> Mon pass personnel</h3>
          <Badge variant={hasPersonalPass(access) ? "default" : "outline"}>{hasPersonalPass(access) ? "Actif" : "Non activé"}</Badge>
        </div>
        {!needsPersonalPassActivation(access) ? (
          <p className="text-muted-foreground">Votre pass est actif d'office. Présentez-le quand vous venez avec votre chien.</p>
        ) : hasPersonalPass(access) ? (
          <>
            <p className="text-muted-foreground">Activé le {fmt(access.personal_pass_at)}. Quand vous venez avec votre chien, un autre valideur peut tamponner votre pass, comme pour tout membre.</p>
            {access.membership_status !== "ACTIVE" && <p className="text-muted-foreground">Les tampons seront possibles une fois votre adhésion validée par le Bureau.</p>}
            <Button variant="outline" size="sm" disabled={run.isPending} onClick={() => run.mutate({ kind: "pass", active: false })}>Désactiver mon pass</Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Vous venez aussi en balade ou au terrain avec votre propre chien ? Activez votre pass pour être reconnu comme participant et recevoir vos tampons.</p>
            <Button size="sm" disabled={run.isPending} onClick={() => run.mutate({ kind: "pass", active: true })}>Activer mon pass</Button>
          </>
        )}
      </div>

      <div className="panel space-y-3 p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg"><ScanLine className="size-4" aria-hidden /> Valider les pass</h3>
          <Badge variant={source ? "default" : "outline"}>{source ? "Valideur" : "Non activé"}</Badge>
        </div>
        {source === "PRO" ? (
          <>
            <p className="flex items-start gap-2 text-muted-foreground"><BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> Valideur d'office en tant que professionnel validé.</p>
            <Button asChild variant="outline" size="sm"><Link to="/espace-pro">Scanner un pass dans mon espace pro</Link></Button>
          </>
        ) : canToggleValidator(access) && source === "BUREAU" ? (
          <>
            <p className="text-muted-foreground">Valideur depuis le {fmt(access.validator_at)}. Le scan est disponible plus bas sur cette page.</p>
            <Button variant="outline" size="sm" disabled={run.isPending} onClick={() => run.mutate({ kind: "validator", active: false })}>Suspendre mon statut valideur</Button>
          </>
        ) : canToggleValidator(access) ? (
          <>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Je tamponne seulement les membres présents, jamais mon propre pass.</li>
              <li>Chaque tampon informe un autre membre du Bureau et reste tracé.</li>
              <li>Un membre dont l'adhésion n'est pas validée ne reçoit pas de tampon.</li>
            </ul>
            <label className="flex items-start gap-2">
              <Checkbox checked={rulesRead} onCheckedChange={(v) => setRulesRead(v === true)} aria-describedby="pass-access-title" />
              <span>J'ai lu ces règles et je m'engage à les respecter.</span>
            </label>
            <Button size="sm" disabled={!rulesRead || run.isPending} onClick={() => run.mutate({ kind: "validator", active: true })}>Activer mon statut valideur</Button>
          </>
        ) : (
          <p className="text-muted-foreground">La validation des pass est réservée aux professionnels validés et aux membres du Bureau qui l'activent.</p>
        )}
      </div>
    </section>
  );
}
