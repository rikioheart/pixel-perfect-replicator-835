import { publicSeo } from '@/components/PublicSeo';
import { PublicPageIntro } from '@/components/PublicPageIntro';
import { createFileRoute } from '@tanstack/react-router';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { PublicPartnerDirectory } from '@/components/PublicPartnerDirectory';
import { publicPartnersOptions } from '@/lib/public-partners.queries';

export const Route = createFileRoute('/professionnels/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicPartnersOptions),
  head: () => ({
    links: publicSeo('/professionnels').links,
    meta: [
      ...publicSeo('/professionnels').meta,
      { title: 'Partenaires — La Voix du Chien' },
      { name: 'description', content: 'Rencontrez les partenaires de La Voix du Chien : métiers, localisations et fiches publiées avec leur accord.' },
      { property: 'og:title', content: 'Partenaires — La Voix du Chien' },
      { property: 'og:description', content: 'Un réseau bienveillant de partenaires pour accompagner votre chien.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: PartnersPage,
});

function PartnersPage() {
  return <div className="public-site min-h-screen bg-background">
    <PublicHeader />
    <main id="contenu" className="public-main space-y-6">
      <PublicPageIntro eyebrow="Un réseau de confiance" title="Nos partenaires">Des professionnels validés par l’association, visibles avec leur accord.</PublicPageIntro>
      <PublicPartnerDirectory showTitle={false} />
    </main>
    <PublicFooter />
  </div>;
}
