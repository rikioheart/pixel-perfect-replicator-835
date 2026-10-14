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
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div className="max-w-3xl space-y-3">
          <h1 className="font-display text-3xl">Nos activités et accompagnements</h1>
          <p className="text-muted-foreground">{ABOUT.intro}</p>
        </div>
        <nav aria-label="Sommaire" className="flex flex-wrap gap-2">
          {SERVICES.map((s) => <a key={s.slug} href={`#${s.slug}`} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{s.title}</a>)}
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
        <Link to="/agenda" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm text-primary-foreground"><CalendarDays className="size-5" aria-hidden />Voir les prochaines dates</Link>
      </main>
      <PublicFooter />
    </div>
  );
}
