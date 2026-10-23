import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stamp, QrCode, RefreshCw, Trophy, Copy } from "lucide-react";
import { passShortCode } from "@/lib/pass-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  fetchLoyaltyRules,
  eligibleGrants,
  tierProgress,
  recomputeLoyaltyForMember,
  LOYALTY_SCOPE_LABEL,
} from "@/lib/loyalty-rules";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import QRCode from 'qrcode';
import { useOnline, readOfflinePass, type OfflinePass } from '@/lib/offline';

export const Route = createFileRoute("/_authenticated/loyalty")({
  head: () => ({
    meta: [
      { title: "Ma carte de fidélité — La Voix du Chien" },
      {
        name: "description",
        content:
          "Consultez vos tampons de fidélité, votre code d'identification et l'historique de vos participations.",
      },
      { property: "og:title", content: "Ma carte de fidélité — La Voix du Chien" },
      {
        property: "og:description",
        content: "Tampons, code de fidélité et historique des activités éligibles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoyaltyPage,
});

const CARD_SIZE = 10;

function LoyaltyPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [recomputing, setRecomputing] = useState(false);
  const online = useOnline();
  const [qrImage, setQrImage] = useState('');
  const [offlinePass, setOfflinePass] = useState<OfflinePass | null>(null);

  const { data: card, isLoading, isError } = useQuery({
    queryKey: ["loyalty-card", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_cards")
        .select("*")
        .eq("member_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if(!card?.qr_code || !user) return;
    let active = true;
    void QRCode.toDataURL(card.qr_code,{width:220,margin:2}).then(qr => {
      if(!active) return;
      setQrImage(qr);
      const snapshot: OfflinePass = {owner:user.id,name:profile?.display_name || 'Mon pass',qr,code:passShortCode(card.qr_code),total:card.total_stamps,savedAt:new Date().toISOString()};
      try { localStorage.setItem('lvdc.offline.pass',JSON.stringify(snapshot)); } catch { toast.info('Le stockage de ce téléphone ne permet pas de sauvegarder le pass.'); }
    });
    return () => { active = false; };
  }, [card?.qr_code,card?.total_stamps,user?.id,profile?.display_name]);

  // Sans réponse du serveur (hors réseau ou erreur), on affiche la copie locale de CE compte.
  useEffect(() => {
    if (!user?.id || card || (online && !isError)) { setOfflinePass(null); return; }
    setOfflinePass(readOfflinePass(user.id));
  }, [user?.id, card, online, isError]);

  // Crée la carte à la première visite (jamais si la lecture a échoué : l'absence n'est pas certaine).
  useEffect(() => {
    if (!user?.id || isLoading || isError || card || !online) return;
    void (async () => {
      await supabase.from("loyalty_cards").insert({ member_id: user.id });
      void queryClient.invalidateQueries({ queryKey: ["loyalty-card", user.id] });
    })();
  }, [user?.id, isLoading, isError, card, queryClient, online]);

  const { data: stamps = [] } = useQuery({
    queryKey: ["loyalty-stamps", card?.id],
    enabled: Boolean(card?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_stamps")
        .select("id,stamps,note,created_at,activities(title)")
        .eq("card_id", card!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["loyalty-rules"],
    queryFn: fetchLoyaltyRules,
  });

  const total = card?.total_stamps ?? offlinePass?.total ?? 0;
  const filled = total % CARD_SIZE;
  const completed = Math.floor(total / CARD_SIZE);
  const grants = eligibleGrants(rules, profile?.membership_type ?? null);
  const tiers = tierProgress(rules, total);

  const recompute = async () => {
    if (!user?.id) return;
    setRecomputing(true);
    try {
      const granted = await recomputeLoyaltyForMember(user.id);
      await queryClient.invalidateQueries();
      toast.success(
        granted > 0
          ? `Recalcul terminé : ${granted} tampon(s) ajouté(s).`
          : "Recalcul terminé : votre carte était déjà à jour.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recalcul impossible.");
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <AppShell title="Ma carte de fidélité" subtitle="Vos tampons et votre historique d'activités">
      <p className="mb-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
        La carte de fidélité fait partie du règlement intérieur de l'association (article 19 des
        statuts). Elle remercie votre participation, sans jamais comparer les membres entre eux.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stamp className="size-4" /> {total} tampon{total > 1 ? "s" : ""} cumulé
              {total > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
              {Array.from({ length: CARD_SIZE }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full border text-xs",
                    index < filled
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-dashed border-border text-muted-foreground",
                  )}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {completed > 0
                ? `${completed} carte${completed > 1 ? "s" : ""} complétée${completed > 1 ? "s" : ""} — parlez-en au Bureau pour vos avantages.`
                : `Encore ${CARD_SIZE - filled} tampon(s) avant votre première carte complète.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4" /> Mon Pass Terrain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {card?.qr_code ? (
              <>
                <img
                  src={qrImage || undefined}
                  alt="QR code du Pass Terrain à présenter au professionnel"
                  className="mx-auto w-full max-w-[280px] rounded-md border border-border bg-white p-2"
                  width={280}
                  height={280}
                />
                <p className="text-center font-mono text-2xl tracking-widest" aria-label="Code court du pass">{passShortCode(card.qr_code)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mx-auto flex"
                  onClick={() => {
                    void navigator.clipboard?.writeText(passShortCode(card.qr_code)).then(
                      () => toast.success("Code copié."),
                      () => toast.info("Copie impossible : lisez le code à voix haute."),
                    );
                  }}
                >
                  <Copy className="size-4" aria-hidden /> Copier mon code
                </Button>
                <p className="text-center text-xs text-muted-foreground">Pass sauvegardé sur ce téléphone pour le présenter sans réseau. Le QR identifie votre carte ; il ne confirme pas votre adhésion.</p>
              </>
            ) : offlinePass ? (
              <>
                <img
                  src={offlinePass.qr}
                  alt="QR code du Pass Terrain à présenter au professionnel"
                  className="mx-auto w-full max-w-[280px] rounded-md border border-border bg-white p-2"
                  width={280}
                  height={280}
                />
                {offlinePass.code && <p className="text-center font-mono text-2xl tracking-widest" aria-label="Code court du pass">{offlinePass.code}</p>}
                <p role="status" className="text-center text-xs text-muted-foreground">
                  Copie enregistrée sur ce téléphone le {new Date(offlinePass.savedAt).toLocaleString("fr-FR")}. Les tampons affichés sont ceux confirmés à cette date.
                </p>
              </>
            ) : !online || isError ? (
              <p className="text-muted-foreground">Pass indisponible sans réseau sur ce téléphone. Ouvrez cette page une fois avec du réseau pour l’enregistrer.</p>
            ) : (
              <p className="text-muted-foreground">Création de votre carte en cours…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stamp className="size-4" /> Mon éligibilité (barèmes actifs)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {grants.length === 0 ? (
              <p className="text-muted-foreground">
                Aucun barème actif ne s'applique à votre profil pour le moment.
              </p>
            ) : (
              grants.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{rule.label ?? rule.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {LOYALTY_SCOPE_LABEL[rule.scope] ?? rule.scope}
                      {rule.match_code ? ` · ${rule.match_code}` : ""}
                      {rule.eligible_membership_types.length > 0
                        ? ` · ${rule.eligible_membership_types.join(", ")}`
                        : " · tous les adhérents"}
                    </p>
                  </div>
                  <Badge variant="secondary">+{rule.stamps_given}</Badge>
                </div>
              ))
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Les tampons sont attribués automatiquement dès qu'une participation ou un événement
              est validé.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Paliers et récompenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {tiers.length === 0 ? (
              <p className="text-muted-foreground">Aucun palier configuré.</p>
            ) : (
              tiers.map((tier) => (
                <div key={tier.rule.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">
                      {tier.rule.reward_label ?? tier.rule.label ?? "Récompense"}
                    </p>
                    <Badge variant={tier.reached ? "default" : "outline"}>
                      {tier.reached ? "Atteint" : `${tier.remaining} restant(s)`}
                    </Badge>
                  </div>
                  <Progress value={tier.percent} />
                  <p className="text-xs text-muted-foreground">
                    {total} / {tier.threshold} tampons
                  </p>
                </div>
              ))
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={recompute}
              disabled={recomputing || !user?.id}
            >
              <RefreshCw className="mr-2 size-4" />
              {recomputing ? "Recalcul en cours…" : "Recalculer mes tampons"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historique des tampons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {stamps.length === 0 ? (
            <p className="text-muted-foreground">Aucun tampon pour le moment.</p>
          ) : (
            stamps.map((stamp) => (
              <div
                key={stamp.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {(stamp.activities as { title: string } | null)?.title ?? stamp.note ?? "Participation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(stamp.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}
                  </p>
                </div>
                <Badge variant="secondary">+{stamp.stamps}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
