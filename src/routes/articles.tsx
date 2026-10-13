import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { BookOpen, ExternalLink, FileText, Newspaper } from 'lucide-react';
import { PublicHeader } from '@/components/PublicHeader';
import { getPlatformArticles, getWordPressArticles } from '@/lib/public-articles.functions';
import { GUIDES, type PlatformArticle, type WordPressArticle } from '@/lib/public-articles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const articlesOptions = queryOptions({ queryKey: ['public-articles'], queryFn: () => getWordPressArticles(), staleTime: 10 * 60 * 1000 });
const platformOptions = queryOptions({ queryKey: ['public-platform-articles'], queryFn: () => getPlatformArticles(), staleTime: 5 * 60 * 1000 });

export const Route = createFileRoute('/articles')({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(articlesOptions), context.queryClient.ensureQueryData(platformOptions)]),
  head: () => ({
    meta: [
      { title: 'Articles et guides — La Voix du Chien' },
      { name: 'description', content: 'Articles du blog de l’association La Voix du Chien et guides éducatifs pour mieux comprendre son chien.' },
      { property: 'og:title', content: 'Articles et guides — La Voix du Chien' },
      { property: 'og:description', content: 'Le blog de l’association et des repères éducatifs bienveillants.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ArticlesPage,
});

type Filter = 'all' | 'site' | 'guide';
type Item = WordPressArticle | PlatformArticle;
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function ArticlesPage() {
  const { data } = useSuspenseQuery(articlesOptions);
  const { data: own } = useSuspenseQuery(platformOptions);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState<PlatformArticle | null>(null);
  const guide = GUIDES.find((g) => g.slug === open);
  const items: Item[] = [...own, ...data.articles].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl">Articles et guides</h1>
          <p className="max-w-2xl text-muted-foreground">Les articles du blog de l’association et des repères éducatifs pour observer et accompagner son chien avec bienveillance.</p>
        </div>
        <div role="group" aria-label="Type de contenu" className="flex flex-wrap gap-2">
          {([['all', 'Tout'], ['site', 'Blog'], ['guide', 'Guides éducatifs']] as const).map(([v, l]) => (
            <Button key={v} size="sm" variant={filter === v ? 'default' : 'outline'} aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</Button>
          ))}
        </div>

        {filter !== 'site' && (
          <section aria-labelledby="guides" className="space-y-3">
            <h2 id="guides" className="flex items-center gap-2 font-display text-xl"><BookOpen className="size-5 text-primary" /> Guides éducatifs</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {GUIDES.map((g) => (
                <Card key={g.slug} className="flex flex-col">
                  <CardHeader className="pb-2"><Badge variant="secondary" className="w-fit">Guide</Badge><CardTitle className="text-base">{g.title}</CardTitle></CardHeader>
                  <CardContent className="mt-auto space-y-3 text-sm">
                    <p className="text-muted-foreground">{g.lead}</p>
                    <Button size="sm" variant="outline" onClick={() => setOpen(g.slug)}>Lire le guide</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {filter !== 'guide' && (
          <section aria-labelledby="blog" className="space-y-3">
            <h2 id="blog" className="flex items-center gap-2 font-display text-xl"><Newspaper className="size-5 text-primary" /> Le blog de l’association</h2>
            {data.unavailable && <p className="text-sm text-muted-foreground">Une partie du blog est momentanément indisponible. <a className="underline" href="https://lavoixduchien.fr/" target="_blank" rel="noreferrer">Le consulter sur notre site</a>.</p>}
            {items.length === 0 ? (
              !data.unavailable && <p className="text-sm text-muted-foreground">Aucun article publié pour le moment.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((a) => (
                  <Card key={`${a.source}-${a.id}`} className="overflow-hidden">
                    {a.image && <img src={a.image} alt="" loading="lazy" className="aspect-[16/9] w-full bg-muted object-cover" />}
                    <CardHeader className="pb-2">
                      <p className="text-xs text-muted-foreground">{fmt(a.date)}</p>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {a.excerpt && <p className="line-clamp-3 text-muted-foreground">{a.excerpt}</p>}
                      {a.source === 'site' ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                          Lire l’article <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(ouvre le site de l’association)</span>
                        </a>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {a.content && <Button size="sm" variant="outline" onClick={() => setReading(a)}>Lire l’article</Button>}
                          {a.attachment && <Button asChild size="sm" variant="ghost"><a href={a.attachment.url} target="_blank" rel="noreferrer"><FileText className="size-4" aria-hidden /> {a.attachment.name}</a></Button>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <Dialog open={!!reading} onOpenChange={(o) => !o && setReading(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {reading && (
            <>
              <DialogHeader><DialogTitle>{reading.title}</DialogTitle><DialogDescription>{fmt(reading.date)}</DialogDescription></DialogHeader>
              {reading.image && <img src={reading.image} alt="" className="w-full rounded-md object-cover" />}
              <div className="space-y-3 whitespace-pre-line text-sm">{reading.content}</div>
              {reading.attachment && <Button asChild variant="outline"><a href={reading.attachment.url} target="_blank" rel="noreferrer"><FileText className="size-4" aria-hidden /> {reading.attachment.name}</a></Button>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!guide} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {guide && (
            <>
              <DialogHeader><DialogTitle>{guide.title}</DialogTitle><DialogDescription>{guide.lead}</DialogDescription></DialogHeader>
              <div className="space-y-4 text-sm">
                {guide.body.map((p) => <p key={p}>{p}</p>)}
                {guide.sections.map((s) => (
                  <div key={s.title} className="space-y-2">
                    <h3 className="font-semibold">{s.title}</h3>
                    {s.text && <p>{s.text}</p>}
                    {s.items && <ul className="list-disc space-y-1 pl-5">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
                  </div>
                ))}
                <p className="rounded-md bg-muted p-3 text-muted-foreground">Ce guide apporte des repères généraux ; il ne remplace pas un accompagnement adapté à la situation de votre chien.</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
