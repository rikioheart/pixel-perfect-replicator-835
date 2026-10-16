import { Button } from '@/components/ui/button';
import { PublicPageIntro } from '@/components/PublicPageIntro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, Check } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { ABOUT, SERVICES } from '@/lib/site-content';

export const Route = createFileRoute('/services')({
  head: () => ({
    meta: [
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
        <nav aria-label="Sommaire" className="flex flex-wrap gap-2">
          {SERVICES.map((s) => <a key={s.slug} href={`#${s.slug}`} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-3 py-1 text-sm">{s.title}</a>)}
        </nav>
        <div className="grid gap-4 md:grid-cols-2">
          {SERVICES.map((s) => (
            <article key={s.slug} id={s.slug} className="panel scroll-mt-6 space-y-3 p-5">
              <h2 className="text-xl">{s.title}</h2>
              <p className="font-medium">{s.summary}</p>
              {s.body.map((p) => <p key={p} className="text-sm text-muted-foreground">{p}</p>)}
              {s.points && <ul className="space-y-1 text-sm">{s.points.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{p}</li>)}</ul>}
            </article>
          ))}
        </div>
        <Button asChild><Link to="/agenda"><CalendarDays className="size-5" aria-hidden />Voir les prochaines dates</Link></Button>
      </main>
      <PublicFooter />
    </div>
  );
}
