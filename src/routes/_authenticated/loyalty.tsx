import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stamp, QrCode, RefreshCw, Trophy } from "lucide-react";
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

  const { data: card, isLoading } = useQuery({
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

  // Crée la carte à la première visite.
  useEffect(() => {
    if (!user?.id || isLoading || card) return;
    void (async () => {
      await supabase.from("loyalty_cards").insert({ member_id: user.id });
      void queryClient.invalidateQueries({ queryKey: ["loyalty-card", user.id] });
    })();
  }, [user?.id, isLoading, card, queryClient]);

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

  const total = card?.total_stamps ?? 0;
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
              <QrCode className="size-4" /> Mon code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {card?.qr_code ? (
              <>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(card.qr_code)}`}
                  alt="QR code de la carte de fidélité"
                  className="mx-auto rounded-md border border-border bg-white p-2"
                  loading="lazy"
                  width={220}
                  height={220}
                />
                <p className="break-all text-center text-xs text-muted-foreground">{card.qr_code}</p>
              </>
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
