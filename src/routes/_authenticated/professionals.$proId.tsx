import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Globe, MapPin, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { avatarUrl, useActiveProsOfMonth } from "@/lib/pros";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/professionals/$proId")({
  head: () => ({
    meta: [
      { title: "Profil professionnel — La Voix du Chien" },
      {
        name: "description",
        content:
          "Fiche d'un professionnel partenaire : spécialité, coordonnées, conditions de partenariat et activités animées.",
      },
      { property: "og:title", content: "Profil professionnel — La Voix du Chien" },
      {
        property: "og:description",
        content: "Spécialité, coordonnées et partenariat du professionnel.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfessionalDetailPage,
  errorComponent: ({ error }) => (
    <AppShell title="Professionnel">
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Professionnel">
      <p className="text-sm text-muted-foreground">Professionnel introuvable.</p>
    </AppShell>
  ),
});

function ProfessionalDetailPage() {
  const { proId } = Route.useParams();
  const { isBureau } = useAuth();

  const { data: pro, isLoading } = useQuery({
    queryKey: ["pro-detail", proId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_details")
        .select("*, profiles(display_name, first_name, last_name, city, email, phone, avatar_path)")
        .eq("profile_id", proId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: accounting = [] } = useQuery({
    queryKey: ["pro-accounting", proId],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting")
        .select("id,label,gross_revenue,association_share,professional_share,recorded_on")
        .eq("professional_id", proId)
        .order("recorded_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: topPros } = useActiveProsOfMonth();

  if (isLoading) {
    return (
      <AppShell title="Professionnel">
        <LoadingState label="Chargement des informations…" rows={4} />
      </AppShell>
    );
  }

  if (!pro) {
    return (
      <AppShell title="Professionnel">
        <p className="text-sm text-muted-foreground">Professionnel introuvable.</p>
      </AppShell>
    );
  }

  const profile = pro.profiles as {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    avatar_path: string | null;
  } | null;
  const photo = avatarUrl(profile?.avatar_path);
  const isActiveThisMonth = Boolean(topPros?.get(pro.profile_id));
  const socials = (pro.social_links ?? {}) as Record<string, string>;

  return (
    <AppShell
      title={pro.company_name}
      subtitle={pro.professional_category ?? "Professionnel partenaire"}
      actions={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/professionals">
            <ArrowLeft className="size-4" /> Annuaire
          </Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {photo ? (
          <img
            src={photo}
            alt={`Photo de ${pro.company_name}`}
            className="size-24 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="flex size-24 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Briefcase className="size-8" />
          </span>
        )}
        <div>
          <p className="font-display text-xl">{pro.company_name}</p>
          {profile?.city ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {profile.city}
            </p>
          ) : null}
          {isActiveThisMonth ? (
            <Badge className="mt-2 gap-1">
              <Sparkles className="size-3" /> Professionnel le plus actif ce mois-ci
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Présentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pro.description ? <p className="text-muted-foreground">{pro.description}</p> : null}
            {pro.website_url ? (
              <p className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <a href={pro.website_url} target="_blank" rel="noreferrer" className="underline">
                  {pro.website_url}
                </a>
              </p>
            ) : null}
            {Object.entries(socials).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(socials).map(([key, value]) => (
                  <Badge key={key} variant="outline">
                    {key} : {value}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="flex items-center gap-2">
              <Briefcase className="size-4 text-muted-foreground" /> Reversement association :{" "}
              {Number(pro.partnership_percentage)} %
            </p>
            {pro.can_grant_stamps ? <Badge>Peut délivrer des tampons fidélité</Badge> : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium">
                {profile?.display_name ??
                  [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ??
                  "—"}
              </p>
              {profile?.city ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4" /> {profile.city}
                </p>
              ) : null}
              {profile?.email ? <p className="text-muted-foreground">{profile.email}</p> : null}
              {profile?.phone ? <p className="text-muted-foreground">{profile.phone}</p> : null}
            </CardContent>
          </Card>

          {isBureau ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Suivi financier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {accounting.length === 0 ? (
                  <p className="text-muted-foreground">Aucune ligne comptable.</p>
                ) : (
                  accounting.map((row) => (
                    <div key={row.id} className="border-b border-border pb-2 last:border-0">
                      <p className="font-medium">{row.label ?? "Recette"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.recorded_on).toLocaleDateString("fr-FR")} · brut{" "}
                        {Number(row.gross_revenue).toFixed(2)} € · asso{" "}
                        {Number(row.association_share).toFixed(2)} € · pro{" "}
                        {Number(row.professional_share).toFixed(2)} €
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
