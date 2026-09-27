import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarRange, Dog, Gift, Handshake, IdCard, Inbox, Stamp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PRO_STATUS_LABEL, completion } from "@/lib/pro-card";

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

const TILES = [
  { to: "/espace-pro/carte", label: "Ma carte professionnelle", icon: IdCard },
  { to: "/activities", label: "Activités", icon: CalendarDays },
  { to: "/events", label: "Événements", icon: CalendarRange },
  { to: "/espace-pro/chiens", label: "Chiens accompagnés", icon: Dog },
  { to: "/espace-pro/collaborations", label: "Collaborations", icon: Handshake },
  { to: "/advantages", label: "Avantages", icon: Gift },
  { to: "/loyalty", label: "Fidélité", icon: Stamp },
  { to: "/proposals", label: "Demandes", icon: Inbox },
] as const;

function ProDashboard() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["pro-dashboard", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [card, dogs, collabs] = await Promise.all([
        supabase.from("professional_public_profile").select("*").eq("profile_id", user!.id).maybeSingle(),
        supabase.rpc("get_pro_dogs"),
        supabase.from("professional_collaborations").select("id", { count: "exact", head: true }).eq("professional_id", user!.id),
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
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>
      <nav aria-label="Espace professionnel" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="panel flex min-h-16 items-center gap-3 p-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <t.icon className="size-5 text-primary" aria-hidden /> <span className="text-sm font-medium">{t.label}</span>
          </Link>
        ))}
      </nav>
    </AppShell>
  );
}
