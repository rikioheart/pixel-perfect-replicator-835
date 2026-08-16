import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Globe, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { avatarUrl, useActiveProsOfMonth } from "@/lib/pros";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/professionals/")({
  head: () => ({
    meta: [
      { title: "Annuaire des professionnels — La Voix du Chien" },
      {
        name: "description",
        content:
          "Annuaire des professionnels partenaires de l'association : éducateurs, comportementalistes, toiletteurs et vétérinaires.",
      },
      { property: "og:title", content: "Annuaire des professionnels — La Voix du Chien" },
      {
        property: "og:description",
        content: "Trouvez un professionnel partenaire de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfessionalsPage,
});

function ProfessionalsPage() {
  const [search, setSearch] = useState("");

  const { data: pros = [], isLoading } = useQuery({
    queryKey: ["pro-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_details")
        .select("*, profiles(display_name, first_name, last_name, city, avatar_path)")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: topPros } = useActiveProsOfMonth();

  const term = search.trim().toLowerCase();
  const filtered = pros.filter((pro) =>
    term
      ? [pro.company_name, pro.professional_category, pro.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      : true,
  );

  return (
    <AppShell title="Professionnels" subtitle="Annuaire des professionnels partenaires">
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher un professionnel…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement de l'annuaire…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Annuaire en construction"
          message="Les professionnels partenaires apparaîtront ici dès leur adhésion validée."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((pro) => {
            const proProfile = pro.profiles as { avatar_path: string | null } | null;
            const photo = avatarUrl(proProfile?.avatar_path);
            const activeCount = topPros?.get(pro.profile_id);
            return (
            <Card key={pro.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  {photo ? (
                    <img
                      src={photo}
                      alt={`Photo de ${pro.company_name}`}
                      loading="lazy"
                      className="size-14 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Briefcase className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{pro.company_name}</CardTitle>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pro.professional_category ? (
                        <Badge variant="secondary">{pro.professional_category}</Badge>
                      ) : null}
                      {activeCount ? (
                        <Badge className="gap-1">
                          <Sparkles className="size-3" /> Actif ce mois-ci
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {pro.description ? (
                  <p className="line-clamp-3 text-muted-foreground">{pro.description}</p>
                ) : null}
                {pro.website_url ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="size-4" />
                    <span className="truncate">{pro.website_url}</span>
                  </p>
                ) : null}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="size-4" /> Partenariat {Number(pro.partnership_percentage)} %
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/professionals/$proId" params={{ proId: pro.profile_id }}>
                    Voir le profil
                  </Link>
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
