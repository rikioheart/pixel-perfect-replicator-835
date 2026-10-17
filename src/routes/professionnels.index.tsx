import { publicSeo } from '@/components/PublicSeo';
import { PublicPageIntro } from '@/components/PublicPageIntro';
import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { Briefcase, MapPin } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { ProMap } from '@/components/ProMap';
import { getPublicPros } from '@/lib/public-articles.functions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const prosOptions = queryOptions({ queryKey: ['public-pros-list'], queryFn: () => getPublicPros(), staleTime: 5 * 60 * 1000 });

export const Route = createFileRoute('/professionnels/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(prosOptions),
  head: () => ({
    links: publicSeo('/professionnels').links,
    meta: [
      ...publicSeo('/professionnels').meta,
      { title: 'Professionnels référencés — La Voix du Chien' },
      { name: 'description', content: 'Les professionnels du réseau La Voix du Chien validés par le Bureau, filtrables par métier et localisation.' },
      { property: 'og:title', content: 'Professionnels référencés — La Voix du Chien' },
      { property: 'og:description', content: 'Trouvez un professionnel validé par l’association près de chez vous.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ProsPage,
});

const sel = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

function ProsPage() {
  const { data } = useSuspenseQuery(prosOptions);
  const [job, setJob] = useState('');
  const [place, setPlace] = useState('');
  const jobs = useMemo(() => [...new Set(data.pros.flatMap((p) => [p.sector, ...p.specialties]).filter(Boolean) as string[])].sort(), [data.pros]);
  const places = useMemo(() => [...new Set(data.pros.map((p) => p.city).filter(Boolean) as string[])].sort(), [data.pros]);
  const list = data.pros.filter((p) => (!job || p.sector === job || p.specialties.includes(job)) && (!place || p.city === place));

  return (
    <div className="public-site min-h-screen bg-background">
      <PublicHeader />
      <main id="contenu" className="public-main space-y-8">
        <PublicPageIntro eyebrow="Un réseau de confiance" title="Professionnels référencés">Professionnels membres de l’association, validés par le Bureau, qui ont choisi d’apparaître publiquement.</PublicPageIntro>
        <ProMap pros={data.pros} onSelect={setPlace} />
        {data.pros.length > 0 && (
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <div><Label htmlFor="f-job">Métier</Label><select id="f-job" className={sel} value={job} onChange={(e) => setJob(e.target.value)}><option value="">Tous les métiers</option>{jobs.map((j) => <option key={j}>{j}</option>)}</select></div>
            <div><Label htmlFor="f-place">Localisation</Label><select id="f-place" className={sel} value={place} onChange={(e) => setPlace(e.target.value)}><option value="">Toutes les localisations</option>{places.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
        )}
        {data.unavailable ? (
          <p className="text-sm text-muted-foreground">La liste est momentanément indisponible. Merci de réessayer plus tard.</p>
        ) : data.pros.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Aucun professionnel n’est encore référencé publiquement. En attendant, découvrez <Link to="/association" className="underline">les partenaires de l’association</Link>.
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun professionnel ne correspond à ces critères. <Button variant="link" onClick={() => { setJob(''); setPlace(''); }}>Effacer les filtres</Button></p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <Card key={p.slug}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Briefcase className="size-4 text-primary" aria-hidden /> {p.name}</CardTitle>
                  {p.sector && <Badge variant="secondary" className="w-fit">{p.sector}</Badge>}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {p.city && <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" aria-hidden /> {p.city}</p>}
                  {p.specialties.length > 0 && <p className="text-muted-foreground">{p.specialties.join(' · ')}</p>}
                  <Button asChild size="sm" variant="outline" className="w-full"><Link to="/professionnels/$slug" params={{ slug: p.slug }}>Voir la fiche</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
