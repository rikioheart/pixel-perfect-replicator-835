import { publicSeo } from '@/components/PublicSeo';
import { createFileRoute } from "@tanstack/react-router";
import { publicPartnersOptions } from "@/lib/public-partners.queries";
import { PublicPartnerDirectory } from "@/components/PublicPartnerDirectory";

import { UpdatesWall } from "@/components/UpdatesWall";
import { PublicFooter, PublicHeader } from "@/components/PublicHeader";
import { PublicWelcome } from '@/components/PublicWelcome';

export const Route = createFileRoute("/association")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicPartnersOptions),
  head: () => ({
    links: publicSeo('/association').links,
    meta: [
      ...publicSeo('/association').meta,
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
    <div className="public-site min-h-screen bg-background">
      <PublicHeader />

      <main id="contenu" className="public-main space-y-12 pt-6">
        <PublicWelcome showPartnerLink={false} />
        <PublicPartnerDirectory />

        <UpdatesWall publicOnly compact limit={5} />

      </main>
      <PublicFooter />

    </div>
  );
}
