import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PawPrint, HeartHandshake, Leaf, CalendarDays, MapPin, ArrowUpRight, BookOpen, Compass, Footprints } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import walk from '@/assets/public/walk.asset.json';
import companion from '@/assets/public/companion.asset.json';
import { Button } from '@/components/ui/button';
import { OfflineStatus } from './OfflineStatus';
import { SERVICES, ZONES, ABOUT } from '@/lib/site-content';

type Home = { activities: {id:string;title:string;date:string;location:string|null;image_url:string|null}[]; website:string|null };
export function safeWebsite(value: string | null | undefined) {
  try { const u = new URL(value || ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function PublicWelcome({ showPartnerLink = true }: { showPartnerLink?: boolean }) {
  const query = useQuery({queryKey:['public-home'], queryFn:async () => { const {data,error} = await supabase.rpc('get_public_home'); if(error) throw error; return data as unknown as Home; }});
  useEffect(() => { if(query.data) {try {localStorage.setItem('lvdc.public.home',JSON.stringify({...query.data,savedAt:new Date().toISOString()}));}catch{/* unavailable device storage */}} },[query.data]);
  const website = safeWebsite(query.data?.website);
  return <div>
    <OfflineStatus />
    <section className="public-hero">
      <img src={walk.url} alt="Des chiens et leurs humains se promènent ensemble sur un chemin" width={1920} height={1088} fetchPriority="high" />
      <div className="public-hero-copy">
        <p className="hero-label"><PawPrint className="size-4" aria-hidden />Une association · Un réseau · Des liens</p>
        <h1>La Voix<br />du Chien</h1>
        <p className="hero-slogan">Le chien au cœur. L’humain à ses côtés.</p>
        <p className="hero-description">Des rencontres, des petites étapes et de l’entraide pour mieux vivre ensemble, sans jugement ni compétition.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="secondary"><Link to="/professionnels"><MapPin aria-hidden />Rencontrer les professionnels<ArrowUpRight aria-hidden /></Link></Button><Button asChild><a href="#connexion">Accès membre</a></Button></div>
      </div>
    </section>
    <nav aria-label="Découvrir l’association" className="public-discovery">
      <Link to="/agenda"><CalendarDays className="size-5" aria-hidden /><span>Les prochaines rencontres</span></Link>
      {showPartnerLink && <Link to="/association" hash="partenaires"><HeartHandshake className="size-5" aria-hidden /><span>Découverte des partenaires</span></Link>}
      <Link to="/articles"><BookOpen className="size-5" aria-hidden /><span>Articles et guides</span></Link>
    </nav>
    <section className="public-section" aria-labelledby="values-title">
      <p className="public-eyebrow mb-3">Notre philosophie</p>
      <h2 id="values-title">Une place pour chaque duo</h2>
      <p className="mt-4 text-muted-foreground">Association La Voix du Chien réunit particuliers, bénévoles et professionnels autour du bien-être physique, émotionnel et social du chien, dans une approche respectueuse, éthique et scientifiquement fondée.</p>
      <div className="public-values">{[
        {Icon:Leaf,title:'À son rythme',text:'Écouter les besoins de chaque chien, sans le comparer aux autres.'},
        {Icon:HeartHandshake,title:'Avec bienveillance',text:'Trouver sa place, demander de l’aide et partager ses savoir-faire.'},
        {Icon:PawPrint,title:'Ensemble',text:'Coopérer avec des professionnels, dans le respect de chacun.'},
      ].map(({Icon,title,text}) => <article key={title}><Icon className="mb-3 size-5 text-primary" aria-hidden /><h3>{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>)}</div>
    </section>
    <section className="public-section" aria-labelledby="services-title">
      <p className="public-eyebrow mb-3">Comprendre, accompagner, partager</p>
      <h2 id="services-title">Nos activités</h2>
      <p className="mt-3 text-sm text-muted-foreground">Un réseau présent en {ZONES.join(', ')}.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{SERVICES.map((s,i) => {const Icon = [HeartHandshake,PawPrint,Leaf,Compass,BookOpen,Footprints][i] ?? PawPrint;return <Link key={s.slug} to="/services" hash={s.slug} className="public-service-link"><Icon className="mb-3 size-5 text-primary" aria-hidden /><h3>{s.title}</h3><p className="mt-2 text-sm text-muted-foreground">{s.summary}</p><ArrowUpRight className="mt-3 size-4 text-primary" aria-hidden /></Link>;})}</div>
    </section>
    <section className="public-section" aria-labelledby="month-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="month-title">À partager ce mois-ci</h2><Button asChild variant="link" className="px-0"><Link to="/agenda">Tout l’agenda<ArrowUpRight aria-hidden /></Link></Button></div>
      {query.isPending ? <p role="status" className="mt-4 text-sm">Chargement des rencontres…</p> : query.isError ? <p className="mt-4 text-sm">Les activités ne sont pas disponibles pour le moment.</p> : !query.data?.activities.length ? <p className="mt-5 border-l-2 border-sage py-2 pl-4 text-sm text-muted-foreground">De nouvelles rencontres se préparent. Revenez bientôt découvrir le programme.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{query.data.activities.map(a => <article key={a.id} className="panel overflow-hidden">{a.image_url && <img src={a.image_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />}<div className="p-4"><p className="text-sm font-medium text-primary">{new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'})}</p><h3 className="mt-2 text-lg">{a.title}</h3>{a.location && <p className="mt-2 flex gap-2 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden />{a.location}</p>}</div></article>)}</div>}
    </section>
    <section className="public-story" aria-labelledby="story-title">
      <img src={companion.url} alt="Un moment de complicité entre une personne et son chien" width={1200} height={1408} loading="lazy" />
      <div><p className="public-eyebrow mb-3">Le vivant, au quotidien</p><h2 id="story-title">Des humains au service des chiens.</h2><p className="mt-4 text-sm text-muted-foreground">{ABOUT.intro}</p><p className="mt-3 text-sm text-muted-foreground">{ABOUT.network}</p>{website && <Button asChild variant="link" className="mt-4 px-0"><a href={website} target="_blank" rel="noopener noreferrer">Notre site internet<ArrowUpRight aria-hidden /></a></Button>}</div>
    </section>
  </div>;
}
