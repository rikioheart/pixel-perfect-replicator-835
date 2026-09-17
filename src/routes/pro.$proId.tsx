import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Globe, MapPin } from "lucide-react";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/pro/$proId")({
  head: () => ({
    meta: [
      { title: "Fiche professionnel — La Voix du Chien" },
      {
        name: "description",
        content:
          "Fiche publique d'un professionnel partenaire de l'association La Voix du Chien : spécialité, secteur et contact.",
      },
      { property: "og:title", content: "Fiche professionnel — La Voix du Chien" },
      {
        property: "og:description",
        content: "Découvrez un professionnel du réseau canin de La Voix du Chien.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicProPage,
});

type SocialLinks = Record<string, string>;

function PublicProPage() {
  const { proId } = Route.useParams();

  const { data: pro, isLoading } = useQuery({
    queryKey: ["public-professional", proId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_professionals")
        .select("*")
        .eq("id", proId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const socials = (pro?.social_links ?? {}) as unknown as SocialLinks;
  const socialEntries = Object.entries(socials).filter(
    ([, url]) => typeof url === "string" && url.startsWith("http"),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="surface-night">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Logo de l'association La Voix du Chien"
              className="size-9 rounded-full bg-navy-foreground/10 object-contain p-1"
            />
            <span className="font-display text-sm">La Voix du Chien</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/association">
              <ArrowLeft className="mr-2 size-4" /> L'association
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement de la fiche…</p>
        ) : !pro ? (
          <div className="panel p-6">
            <h1 className="font-display text-xl">Fiche introuvable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce professionnel n'a pas de fiche publique, ou celle-ci a été retirée.
            </p>
          </div>
        ) : (
          <article className="panel space-y-5 p-6">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Briefcase className="size-3.5" /> Professionnel partenaire
              </p>
              <h1 className="mt-1 font-display text-3xl">
                {pro.company_name ?? pro.display_name ?? pro.first_name ?? "Professionnel"}
              </h1>
              {pro.display_name && pro.company_name ? (
                <p className="text-sm text-muted-foreground">{pro.display_name}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pro.professional_category ? (
                <Badge variant="secondary">{pro.professional_category}</Badge>
              ) : null}
              {pro.city ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {pro.city}
                  {pro.department ? ` (${pro.department})` : ""}
                </span>
              ) : null}
            </div>

            {pro.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{pro.description}</p>
            ) : null}
            {pro.bio ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {pro.bio}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {pro.website_url ? (
                <a
                  href={pro.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <Globe className="size-3.5" /> Site web
                </a>
              ) : null}
              {socialEntries.map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs capitalize hover:bg-accent"
                >
                  {platform}
                </a>
              ))}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
