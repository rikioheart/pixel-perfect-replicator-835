import { useEffect, useMemo, useState } from 'react';
import { savePublicPros } from '@/lib/offline';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, ExternalLink, Globe, HeartHandshake, MapPin, Search, X } from 'lucide-react';
import { publicPartnersOptions } from '@/lib/public-partners.queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PublicPartnerDirectory({ showTitle = true }: { showTitle?: boolean }) {
  const { data } = useSuspenseQuery(publicPartnersOptions);
  useEffect(() => { savePublicPros(data.pros); }, [data.pros]);
  const [term, setTerm] = useState('');
  const [job, setJob] = useState('all');
  const [place, setPlace] = useState('all');
  const jobs = useMemo(() => [...new Set(data.pros.flatMap(p => [p.sector, ...p.specialties]).filter((value): value is string => Boolean(value)))].sort((a,b) => a.localeCompare(b, 'fr')), [data.pros]);
  const places = useMemo(() => [...new Set(data.pros.map(p => p.city).filter((value): value is string => Boolean(value)))].sort((a,b) => a.localeCompare(b, 'fr')), [data.pros]);
  const search = term.trim().toLocaleLowerCase('fr');
  const filtered = data.pros.filter(p => (!search || [p.name, p.sector, p.city, ...p.specialties].join(' ').toLocaleLowerCase('fr').includes(search)) && (job === 'all' || p.sector === job || p.specialties.includes(job)) && (place === 'all' || p.city === place));

  return <section id="partenaires" className={showTitle ? 'scroll-mt-6 border-t border-border pt-8' : 'scroll-mt-6'} aria-label="Annuaire des partenaires">
    {showTitle && <div className="mb-5"><h2 className="flex items-center gap-3 text-3xl"><HeartHandshake className="size-6 shrink-0 text-primary" aria-hidden />Nos partenaires</h2><p className="mt-2 text-sm text-muted-foreground">Un réseau bienveillant, au service de votre chien.</p></div>}
    {data.pros.length > 0 && <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-2"><Label htmlFor="partner-search">Nom ou métier</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden /><Input id="partner-search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Rechercher…" className="pl-9" /></div></div>
        <div className="min-w-0 space-y-2"><Label htmlFor="partner-job">Métier</Label><Select value={job} onValueChange={setJob}><SelectTrigger id="partner-job"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les métiers</SelectItem>{jobs.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-0 space-y-2"><Label htmlFor="partner-place">Localisation</Label><Select value={place} onValueChange={setPlace}><SelectTrigger id="partner-place"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les localisations</SelectItem>{places.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} partenaire{filtered.length > 1 ? 's' : ''}</p>{(term || job !== 'all' || place !== 'all') && <Button variant="ghost" size="sm" onClick={() => { setTerm(''); setJob('all'); setPlace('all'); }}><X aria-hidden />Effacer</Button>}</div>
    </>}
    {data.unavailable ? <p role="status" className="py-4 text-sm text-muted-foreground">L’annuaire est momentanément indisponible.</p> : !data.pros.length ? <p className="py-4 text-sm text-muted-foreground">Les partenaires apparaîtront ici après validation et choix de publication de leur profil.</p> : !filtered.length ? <p className="py-4 text-sm text-muted-foreground">Aucun partenaire ne correspond à votre recherche.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(p => <article key={p.slug} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h3 className="break-words text-base leading-snug">{p.name}</h3>
      {(p.sector || p.specialties.length > 0) && <p className="line-clamp-2 text-sm text-muted-foreground">{[...new Set([p.sector, ...p.specialties].filter(Boolean))].slice(0, 2).join(' · ')}</p>}
      {p.city && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{p.city}</span></p>}
      {p.links.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-1">{p.links.map(link => <Button key={link.url} asChild variant="link" size="sm" className="h-auto max-w-full px-0 py-2"><a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.label} de ${p.name} (nouvel onglet)`}>{link.label === 'Site internet' ? <Globe aria-hidden /> : <ExternalLink aria-hidden />}<span className="break-words whitespace-normal">{link.label}</span></a></Button>)}</div>}
      <Button asChild variant="link" className="mt-auto h-auto justify-start self-start px-0 py-1"><Link to="/professionnels/$slug" params={{ slug: p.slug }}>Voir la fiche<ArrowRight aria-hidden /></Link></Button>
    </article>)}</div>}
  </section>;
}
