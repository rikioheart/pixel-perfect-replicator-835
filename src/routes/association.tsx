import { createFileRoute, Link } from "@tanstack/react-router";
import { publicPartnersOptions } from "@/lib/public-partners.queries";
import { PublicPartnerDirectory } from "@/components/PublicPartnerDirectory";
import { Globe } from "lucide-react";
import logoMark from "@/assets/logo-lvdc-mark.png.asset.json";
import { UpdatesWall } from "@/components/UpdatesWall";
import { Button } from "@/components/ui/button";
import { PublicWelcome } from '@/components/PublicWelcome';

export const Route = createFileRoute("/association")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicPartnersOptions),
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

function PublicAssociationPage() {
  return ((data ?? []) as unknown as {
        slug: string;
        display_name: string;
        specialties: string[];
        sector: string | null;
        public_city: string | null;
      }[]).slice(0, 24);
    },
  });

  useEffect(() => { if(prosLoaded) {try {localStorage.setItem('lvdc.public.pros',JSON.stringify(pros));}catch{ /* device storage unavailable */ }} },[pros,prosLoaded]);

  return (
    <div className="min-h-screen bg-background">
      <header className="surface-night">
        <div className="mx-auto flex max-w-6xl items-center flex-wrap justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src={logoMark.url}
              alt="Logo de l'association La Voix du Chien"
              className="size-10 rounded-full bg-navy-foreground/10 object-contain p-1"
            />
            <span className="font-display">La Voix du Chien</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Espace membres</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-6 sm:px-6 sm:py-10">
        <PublicWelcome showPartnerLink={false} />
        <PublicPartnerDirectory />

        <UpdatesWall publicOnly compact limit={5} />

      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <Globe className="size-3" /> La Voix du Chien — Nargis, Loiret
        </p>
      </footer>
    </div>
  );
}
