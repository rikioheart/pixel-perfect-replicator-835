import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stamp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PRO_STATUS_LABEL, completion } from "@/lib/pro-card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { readQueue } from "@/lib/offline";
import { ManualStampCard } from "@/components/ManualStampCard";

export const Route = createFileRoute("/_authenticated/espace-pro/")({
  head: () => ({
    meta: [
      { title: "Espace professionnel — La Voix du Chien" },
      { name: "description", content: "Tableau de bord du professionnel : carte, chiens accompagnés, collaborations et demandes." },
      { property: "og:title", content: "Espace professionnel — La Voix du Chien" },
      { property: "og:description", content: "Le tableau de bord des professionnels du réseau." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProDashboard,
});

function ProDashboard() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const refresh = () => setPendingCount(readQueue(user.id).length);
    refresh();
    window.addEventListener("lvdc-offline", refresh);
    return () => window.removeEventListener("lvdc-offline", refresh);
  }, [user?.id]);
  const { data } = useQuery({
    queryKey: ["pro-dashboard", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return { card: null, dogs: 0, collabs: 0 };
      const [card, dogs, collabs] = await Promise.all([
        supabase.from("professional_public_profile").select("*").eq("profile_id", user.id).maybeSingle(),
        supabase.rpc("get_pro_dogs"),
        supabase.from("professional_collaborations").select("id", { count: "exact", head: true }).eq("professional_id", user.id),
      ]);
      return {
        card: card.data,
        dogs: ((dogs.data ?? []) as unknown[]).length,
        collabs: collabs.count ?? 0,
      };
    },
  });
  const card = data?.card;
  const pct = card ? completion(card) : 0;

  return (
    <AppShell title="Espace professionnel" subtitle="Votre activité dans le réseau La Voix du Chien">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel space-y-2 p-4">
          <p className="text-xs text-muted-foreground">Ma carte</p>
          {card ? (
            <>
              <Badge variant={card.status === "ACTIVE" ? "default" : "secondary"}>{PRO_STATUS_LABEL[card.status]}</Badge>
              <Progress value={pct} aria-label={`Profil complété à ${pct} %`} />
              <p className="text-xs text-muted-foreground">Complétée à {pct} %</p>
            </>
          ) : (
            <Link to="/espace-pro/carte" className="text-sm underline">Créer ma carte en 3 étapes</Link>
          )}
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground">Chiens accompagnés (accès actif)</p>
          <p className="font-display text-3xl">{data?.dogs ?? "…"}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground">Collaborations</p>
          <p className="font-display text-3xl">{data?.collabs ?? "…"}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted-foreground">Demandes de tampons sur cet appareil</p>
          <p className="font-display text-3xl">{pendingCount}</p>
          <Button asChild variant="outline" size="sm" className="mt-3"><a href="#pass-terrain"><Stamp className="size-4" aria-hidden /> {pendingCount ? "Vérifier les demandes" : "Valider un pass"}</a></Button>
        </div>
      </div>
      <div id="pass-terrain" className="mt-6 max-w-2xl scroll-mt-20">
        <ManualStampCard />
      </div>
    </AppShell>
  );
}
