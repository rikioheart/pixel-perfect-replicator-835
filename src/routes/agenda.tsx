import { publicSeo } from '@/components/PublicSeo';
import { PublicPageIntro } from '@/components/PublicPageIntro';
import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { getPublicAgenda, spotsLeft } from '@/lib/public-site.functions';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const agendaOptions = queryOptions({ queryKey: ['public-agenda'], queryFn: () => getPublicAgenda(), staleTime: 5 * 60 * 1000 });

export const Route = createFileRoute('/agenda')({
  loader: ({ context }) => context.queryClient.ensureQueryData(agendaOptions),
  head: () => ({
    links: publicSeo('/agenda').links,
    meta: [
      ...publicSeo('/agenda').meta,
      { title: 'Agenda des activités — La Voix du Chien' },
      { name: 'description', content: 'Balades collectives, ateliers et séances à venir : consultez les dates et réservez votre place.' },
      { property: 'og:title', content: 'Agenda des activités — La Voix du Chien' },
      { property: 'og:description', content: 'Les prochaines rencontres ouvertes au public, avec réservation en ligne.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AgendaPage,
});

const monthLabel = (d: string) => new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

function AgendaPage() {
  const { data } = useSuspenseQuery(agendaOptions);
  const { session } = useAuth();
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set(data.activities.map((a) => a.category).filter(Boolean) as string[])].sort(), [data.activities]);
  const list = data.activities.filter((a) => !cat || a.category === cat);
  const months = [...new Set(list.map((a) => monthLabel(a.date)))];

  return (
    <div className="public-site min-h-screen bg-background">
      <PublicHeader />
      <main id="contenu" className="public-main space-y-8">
        <PublicPageIntro eyebrow="Se rencontrer, à leur rythme" title="Agenda des activités">Les rencontres ouvertes au public. La réservation se fait depuis votre espace membre, pour que nous puissions préparer l’accueil de votre chien.</PublicPageIntro>
        {cats.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Type d’activité">
            <Button size="sm" variant={cat ? 'outline' : 'default'} onClick={() => setCat('')}>Toutes</Button>
            {cats.map((c) => <Button key={c} size="sm" variant={cat === c ? 'default' : 'outline'} onClick={() => setCat(c)}>{c}</Button>)}
          </div>
        )}
        {data.unavailable ? (
          <p className="text-sm text-muted-foreground">L’agenda est momentanément indisponible. Merci de réessayer plus tard.</p>
        ) : list.length === 0 ? (
          <div className="panel p-6 text-sm text-muted-foreground">De nouvelles rencontres se préparent. En attendant, consultez <Link to="/professionnels" className="underline">l’annuaire des partenaires</Link> ou <a href="https://lavoixduchien.fr/" target="_blank" rel="noopener noreferrer" className="underline">le site de l’association</a>.</div>
        ) : months.map((m) => (
          <section key={m} aria-label={m} className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl capitalize"><CalendarDays className="size-5 text-primary" aria-hidden />{m}</h2>
            {list.filter((a) => monthLabel(a.date) === m).map((a) => {
              const left = spotsLeft(a);
              const d = new Date(a.date);
              return (
                <article key={a.id} className="panel flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary p-2 text-center text-secondary-foreground">
                    <span className="text-2xl font-display">{d.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'Europe/Paris' })}</span>
                    <span className="text-xs">{d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'Europe/Paris' })} · {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg">{a.title}</h3>{a.category && <Badge variant="secondary">{a.category}</Badge>}</div>
                    {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                    {a.for_you_if && <p className="text-sm"><span className="font-medium">Pour vous si : </span>{a.for_you_if}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {a.location && <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden />{a.location}</span>}
                      {left !== null && <span className="flex items-center gap-1"><Users className="size-4" aria-hidden />{left === 0 ? 'Complet' : `${left} place${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`}</span>}
                      {a.price_public != null && <span>{Number(a.price_public) === 0 ? 'Gratuit' : `${a.price_public} €`}{a.price_member != null && Number(a.price_member) !== Number(a.price_public) ? ` · membres ${a.price_member} €` : ''}</span>}
                    </div>
                  </div>
                  <div className="sm:self-center">
                    {session
                      ? <Button asChild disabled={left === 0}><Link to="/activities/$activityId" params={{ activityId: a.id }}>Réserver</Link></Button>
                      : <Button asChild variant="outline"><Link to="/" hash="connexion">Se connecter pour réserver</Link></Button>}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </main>
      <PublicFooter />
    </div>
  );
}
