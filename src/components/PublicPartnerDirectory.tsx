import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, ExternalLink, HeartHandshake, MapPin, Search, Store, X } from 'lucide-react';
import { publicPartnersOptions } from '@/lib/public-partners.queries';
import { filterPublicPartners, type PublicPartner } from '@/lib/public-partners';
import { partnerImages } from '@/lib/partner-images';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function PublicPartnerDirectory() {
  const {data} = useSuspenseQuery(publicPartnersOptions);
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState('all');
  const [sector, setSector] = useState('all');
  const [selected, setSelected] = useState<PublicPartner | null>(null);
  const sectors = [...new Set(data.partners.map(p => p.sector).filter(Boolean))].sort((a,b) => a.localeCompare(b,'fr'));
  const filtered = filterPublicPartners(data.partners, term, kind, sector);
  return <section id="partenaires" className="scroll-mt-6 border-t border-border pt-10" aria-labelledby="partners-title">
    <div className="mb-7 max-w-2xl">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><HeartHandshake className="size-5" aria-hidden />Un réseau, des liens de confiance</p>
      <h2 id="partners-title" className="text-3xl leading-tight sm:text-4xl">Nos partenaires</h2>
      <p className="mt-4 text-muted-foreground">Des professionnels et des entreprises engagés aux côtés de l’association, pour accompagner chaque chien et les humains qui partagent sa vie.</p>
    </div>
    <div className="mb-6 grid gap-4 border-y border-border py-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2"><Label htmlFor="partner-search">Nom ou besoin</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden /><Input id="partner-search" placeholder="Éducation, balade, photographie…" value={term} onChange={e => setTerm(e.target.value)} className="pl-9" /></div></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="partner-kind">Type de partenaire</Label><Select value={kind} onValueChange={setKind}><SelectTrigger id="partner-kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les partenaires</SelectItem><SelectItem value="services">Accompagnement & services</SelectItem><SelectItem value="commercial">Produits & créations</SelectItem></SelectContent></Select></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="partner-sector">Secteur</Label><Select value={sector} onValueChange={setSector}><SelectTrigger id="partner-sector"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les secteurs</SelectItem>{sectors.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {(data.websiteUnavailable || data.platformUnavailable) && <p role="status" className="mb-4 text-sm text-muted-foreground">Une partie de l’annuaire est momentanément indisponible. <a className="underline" href="https://lavoixduchien.fr/partenaires/" target="_blank" rel="noopener noreferrer">Consulter le site de l’association</a>.</p>}
    <div className="mb-4 flex items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} partenaire{filtered.length > 1 ? 's' : ''}</p>{(term || kind !== 'all' || sector !== 'all') && <Button variant="ghost" size="sm" onClick={() => {setTerm('');setKind('all');setSector('all');}}><X aria-hidden />Effacer les filtres</Button>}</div>
    {!filtered.length ? <p className="py-10 text-center text-muted-foreground">Aucun partenaire ne correspond à cette recherche.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(partner => {
      const Icon = partner.kind === 'commercial' ? Store : HeartHandshake;
      return <article key={partner.id} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {partnerImages[partner.id] && <div className="flex h-44 items-center justify-center border-b border-border bg-card p-4"><img src={partnerImages[partner.id]} alt={`Visuel de ${partner.name}`} loading="lazy" className="h-full w-full object-contain" /></div>}
        <div className="flex flex-1 flex-col p-5">
        <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" aria-hidden />{partner.kind === 'commercial' ? 'Produits & créations' : 'Accompagnement'}</p>
        <h3 className="text-lg leading-snug">{partner.name}</h3>
        {partner.sector && <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-1 size-4 shrink-0" aria-hidden /><span>{partner.sector}</span></p>}
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{partner.specialties.length ? partner.specialties.slice(0,3).join(' · ') : partner.description}</p>
        <div className="mt-auto pt-5">{partner.slug ? <Button asChild variant="link" className="h-auto justify-start whitespace-normal p-0 text-left"><Link to="/professionnels/$slug" params={{slug:partner.slug}}>Découvrir {partner.name}<ArrowRight aria-hidden /></Link></Button> : <Button variant="link" className="h-auto justify-start whitespace-normal p-0 text-left" onClick={() => setSelected(partner)}>Découvrir {partner.name}<ArrowRight aria-hidden /></Button>}</div>
        </div>
      </article>;
    })}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => {if (!open) setSelected(null);}}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg sm:p-8">
      {selected && <>{partnerImages[selected.id] && <img src={partnerImages[selected.id]} alt={`Visuel de ${selected.name}`} className="mx-auto h-32 max-w-full object-contain" />}<DialogHeader className="pr-6"><DialogTitle className="font-display text-2xl leading-snug">{selected.name}</DialogTitle><DialogDescription>{selected.kind === 'commercial' ? 'Produits & créations' : 'Accompagnement & services'}{selected.sector ? ` · ${selected.sector}` : ''}</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm"><p className="whitespace-pre-line leading-relaxed">{selected.description}</p>{selected.specialties.length > 0 && <ul className="list-disc space-y-1 pl-5">{selected.specialties.map((specialty,i) => <li key={`${i}-${specialty}`}>{specialty}</li>)}</ul>}{selected.hours && <p className="border-t border-border pt-4"><strong>Horaires annoncés : </strong>{selected.hours}</p>}</div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">{selected.links.map(link => <Button asChild variant="outline" key={link.url}><a href={link.url} target={link.url.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{link.label}<ExternalLink aria-hidden /></a></Button>)}</div>
      <p className="text-xs text-muted-foreground">Présentation publiée sur le <a className="underline" href="https://lavoixduchien.fr/partenaires/" target="_blank" rel="noopener noreferrer">site de l’association</a>. Les modalités d’accompagnement sont à confirmer directement avec le partenaire.</p></>}
    </DialogContent></Dialog>
  </section>;
}