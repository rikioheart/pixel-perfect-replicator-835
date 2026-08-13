import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stamp, QrCode } from "lucide-react";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const total = card?.total_stamps ?? 0;
  const filled = total % CARD_SIZE;
  const completed = Math.floor(total / CARD_SIZE);

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
