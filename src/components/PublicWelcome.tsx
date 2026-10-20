import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PawPrint, HeartHandshake, Leaf, CalendarDays, ArrowUpRight, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import walk from '@/assets/public/walk.asset.json';
import companion from '@/assets/public/companion.asset.json';
import { Button } from '@/components/ui/button';
import { OfflineStatus } from './OfflineStatus';
import { ZONES, ABOUT } from '@/lib/site-content';

type Home = { activities: {id:string;title:string;date:string;location:string|null;image_url:string|null}[]; website:string|null };
export function safeWebsite(value: string | null | undefined) {
  try { const u = new URL(value || ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function PublicWelcome({ showPartnerLink = true }: { showPartnerLink?: boolean }) {
  const query = useQuery({queryKey:['public-home'], queryFn:async () => { const {data,error} = await supabase.rpc('get_public_home'); if(error) throw error; return data as unknown as Home; }});
  useEffect(() => { if(query.data) {try {localStorage.setItem('lvdc.public.home',JSON.stringify({...query.data,savedAt:new Date().toISOString()}));}catch{/* unavailable device storage */}} },[query.data]);
  const website = safeWebsite(query.data?.website);
  return <div className="contents">
    <OfflineStatus />
    <section className="public-hero">
      <img src={walk.url} alt="Des chiens et leurs humains se promènent ensemble sur un chemin" width={1920} height={1088} fetchPriority="high" />
      <div className="public-hero-copy">
        <p className="hero-label"><PawPrint className="size-4" aria-hidden />Une association · Un réseau · Des liens</p>
        <h1>La Voix<br />du Chien</h1>
        <p className="hero-slogan">Le chien au cœur. L’humain à ses côtés.</p>
        <p className="hero-description">Des rencontres, des petites étapes et de l’entraide pour mieux vivre ensemble, sans jugement ni compétition.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="secondary"><Link to="/professionnels"><HeartHandshake aria-hidden />Nos partenaires<ArrowUpRight aria-hidden /></Link></Button><Button asChild><Link to="/" hash="connexion">Accès membre</Link></Button></div>
      </div>
    </section>
    <nav aria-label="Découvrir l’association" className="public-discovery">
      <Link to="/agenda"><CalendarDays className="size-5" aria-hidden /><span>Les prochaines rencontres</span></Link>
      {showPartnerLink && <Link to="/professionnels"><HeartHandshake className="size-5" aria-hidden /><span>Découverte des partenaires</span></Link>}
      <a href="https://lavoixduchien.fr/" target="_blank" rel="noopener noreferrer"><BookOpen className="size-5" aria-hidden /><span>Articles sur notre site officiel</span></a>
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
      <div className="mt-4 max-w-3xl space-y-3 text-muted-foreground">
        <p>Balades collectives, ateliers à thème, jeux de flair et activités sportives permettent de partager, d’apprendre et de renforcer la relation avec son chien. L’éducation et l’accompagnement comportemental prennent en compte ses émotions, ses besoins et le rythme de chaque duo.</p>
        <p>Les professionnels partenaires accompagnent les rencontres dans un cadre bienveillant, sans compétition. Un bilan préalable permet d’orienter chaque chien vers les activités adaptées.</p>
        <p className="text-sm">Notre réseau intervient en {ZONES.join(', ')}. Les dates ouvertes à la participation sont disponibles dans l’agenda.</p>
        <a href="https://lavoixduchien.fr/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4">En savoir plus sur nos activités<ArrowUpRight className="size-4" aria-hidden /></a>
      </div>
    </section>
    <section className="public-story" aria-labelledby="story-title">
      <img src={companion.url} alt="Un moment de complicité entre une personne et son chien" width={1200} height={1408} loading="lazy" />
      <div><p className="public-eyebrow mb-3">Le vivant, au quotidien</p><h2 id="story-title">Des humains au service des chiens.</h2><p className="mt-4 text-sm text-muted-foreground">{ABOUT.intro}</p><p className="mt-3 text-sm text-muted-foreground">{ABOUT.network}</p>{website && <Button asChild variant="link" className="mt-4 px-0"><a href={website} target="_blank" rel="noopener noreferrer">Notre site internet<ArrowUpRight aria-hidden /></a></Button>}</div>
    </section>
    <section className="public-section text-center" aria-labelledby="support-title">
      <h2 id="support-title">Envie d’en savoir plus ou de soutenir l’association ?</h2>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Articles, adhésion et dons sont réunis sur notre site officiel. Déjà adhérent ? Rejoignez l’espace membre pour participer à la vie associative.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild><a href="https://lavoixduchien.fr/" target="_blank" rel="noopener noreferrer">Visiter lavoixduchien.fr<ArrowUpRight aria-hidden /></a></Button><Button asChild variant="outline"><Link to="/" hash="connexion">Espace membre</Link></Button></div>
    </section>
  </div>;
}
