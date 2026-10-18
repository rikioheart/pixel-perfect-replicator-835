import { publicSeo } from '@/components/PublicSeo';
import { Button } from '@/components/ui/button';
import { PublicPageIntro } from '@/components/PublicPageIntro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { ABOUT, SERVICES } from '@/lib/site-content';

export const Route = createFileRoute('/services')({
  head: () => ({
    links: publicSeo('/services').links,
    meta: [
      ...publicSeo('/services').meta,
      { title: 'Nos activités et accompagnements — La Voix du Chien' },
      { name: 'description', content: 'Bilan comportemental, éducation, rééducation, sports canins, ateliers à thème et balades collectives avec des professionnels bienveillants.' },
      { property: 'og:title', content: 'Nos activités et accompagnements — La Voix du Chien' },
      { property: 'og:description', content: 'Des accompagnements respectueux du chien, avec un réseau de professionnels solidaires.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <div className="public-site min-h-screen bg-background">
      <PublicHeader />
      <main id="contenu" className="public-main space-y-8">
        <PublicPageIntro eyebrow="Une place pour chaque duo" title="Nos activités et accompagnements">{ABOUT.intro}</PublicPageIntro>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <article key={s.slug} className="panel space-y-2 p-5">
              <h2 className="text-xl">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.summary}</p>
            </article>
          ))}
        </div>
        <Button asChild><Link to="/agenda"><CalendarDays className="size-5" aria-hidden />Voir les prochaines dates</Link></Button>
        <Button asChild variant="outline" className="ml-3"><a href="https://lavoixduchien.fr/" target="_blank" rel="noopener noreferrer">Tout savoir sur lavoixduchien.fr<ExternalLink className="size-4" aria-hidden /></a></Button>
      </main>
      <PublicFooter />
    </div>
  );
}
