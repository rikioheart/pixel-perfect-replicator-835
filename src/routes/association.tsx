import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, MapPin, Globe, Briefcase, ArrowRight } from "lucide-react";
import logoAsset from "@/assets/logo-lvdc.png.asset.json";
import { UpdatesWall } from "@/components/UpdatesWall";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/association")({
  head: () => ({
    meta: [
      { title: "La Voix du Chien — Association canine du Loiret" },
      {
        name: "description",
        content:
          "Association La Voix du Chien : éducation bienveillante, activités canines, professionnels partenaires et entraide entre maîtres dans le Loiret.",
      },
      { property: "og:title", content: "La Voix du Chien — Association canine du Loiret" },
      {
        property: "og:description",
        content:
          "Découvrez l'association, ses activités, ses valeurs et les professionnels du réseau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicAssociationPage,
});

const VALUES = [
  {
    title: "Bienveillance",
    body: "Chaque chien et chaque maître avance à son rythme, sans jugement ni méthode coercitive.",
  },
  {
    title: "Entraide",
    body: "Particuliers, professionnels et bénévoles partagent leur temps et leurs savoir-faire.",
  },
  {
    title: "Transparence",
    body: "Chaque action est tracée, partagée et validée collectivement par le Bureau.",
  },
];

function PublicAssociationPage() {
  const { data: pros = [] } = useQuery({
    queryKey: ["public-professionals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_public_pros");
      if (error) throw error;
      return ((data ?? []) as unknown as {
        slug: string;
        display_name: string;
        specialties: string[];
        sector: string | null;
        public_city: string | null;
      }[]).slice(0, 24);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="surface-night">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Logo de l'association La Voix du Chien"
              className="size-10 rounded-full bg-navy-foreground/10 object-contain p-1"
            />
            <span className="font-display">La Voix du Chien</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Espace membres</Link>
          </Button>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
          <h1 className="max-w-2xl text-4xl leading-tight">
            L'association qui donne de la voix pour les chiens et leurs maîtres
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-80">
            Basée à Nargis dans le Loiret, La Voix du Chien réunit des particuliers, des bénévoles et
            des professionnels du monde canin autour d'activités, de formations et d'événements
            ouverts à toutes et tous.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">
                Rejoindre l'association <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-6 py-14">
        <section>
          <h2 className="font-display text-2xl">Nos valeurs</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {VALUES.map((value) => (
              <Card key={value.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HeartHandshake className="size-4 text-primary" /> {value.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{value.body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl">Ce que nous proposons</h2>
          <ul className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <li className="panel p-4">Activités canines encadrées : balades éducatives, ateliers, olfaction, sport.</li>
            <li className="panel p-4">Événements et rencontres ouverts aux adhérents et à leurs chiens.</li>
            <li className="panel p-4">Formations et lives animés par des professionnels du réseau.</li>
            <li className="panel p-4">Carte de fidélité : chaque participation compte et donne droit à des avantages.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl">Les professionnels du réseau</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Éducateurs, comportementalistes, toiletteurs et autres partenaires qui accompagnent
            l'association.
          </p>
          {pros.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Les fiches des professionnels seront publiées prochainement.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pros.map((pro) => (
                <Link
                  key={pro.slug}
                  to="/professionnels/$slug"
                  params={{ slug: pro.slug }}
                  className="panel block p-4 transition-colors hover:bg-accent"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <Briefcase className="size-4 text-primary" aria-hidden />
                    {pro.display_name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pro.specialties.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                  {pro.sector || pro.public_city ? (
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden /> {[pro.sector, pro.public_city].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        <UpdatesWall publicOnly compact limit={5} />

        <section className="panel flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-xl">Envie de nous rejoindre ?</h2>
            <p className="text-sm text-muted-foreground">
              Créez votre compte : le Bureau valide votre adhésion et vous ouvre l'espace membres.
            </p>
          </div>
          <Button asChild>
            <Link to="/">Créer mon compte</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <Globe className="size-3" /> La Voix du Chien — Nargis, Loiret
        </p>
      </footer>
    </div>
  );
}
