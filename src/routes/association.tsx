import { createFileRoute } from "@tanstack/react-router";
import { publicPartnersOptions } from "@/lib/public-partners.queries";
import { PublicPartnerDirectory } from "@/components/PublicPartnerDirectory";
import { Globe } from "lucide-react";
import { UpdatesWall } from "@/components/UpdatesWall";
import { PublicHeader } from "@/components/PublicHeader";
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
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-6 sm:px-6 sm:py-10">
        <PublicWelcome showPartnerLink={false} />
        <PublicPartnerDirectory />

        <UpdatesWall publicOnly compact limit={5} />

      </main>
      <PublicFooter />

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <Globe className="size-3" /> La Voix du Chien — Nargis, Loiret
        </p>
      </footer>
    </div>
  );
}
