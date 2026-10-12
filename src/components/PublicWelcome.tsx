import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PawPrint, HeartHandshake, Leaf, CalendarDays, MapPin, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import life from '@/assets/association-life.jpg';
import { OfflineStatus } from './OfflineStatus';

type Home = { activities: {id:string;title:string;date:string;location:string|null;image_url:string|null}[]; website:string|null };
export function safeWebsite(value: string | null | undefined) {
  try { const u = new URL(value || ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function PublicWelcome({ showPartnerLink = true }: { showPartnerLink?: boolean }) {
  const query = useQuery({queryKey:['public-home'], queryFn:async () => { const {data,error} = await supabase.rpc('get_public_home'); if(error) throw error; return data as unknown as Home; }});
  useEffect(() => { if(query.data) {try {localStorage.setItem('lvdc.public.home',JSON.stringify({...query.data,savedAt:new Date().toISOString()}));}catch{/* unavailable device storage */}} },[query.data]);
  const website = safeWebsite(query.data?.website);
  return <div className="space-y-8">
    <OfflineStatus />
    <section className="public-cover relative isolate min-h-[380px] overflow-hidden p-6 sm:p-9">
      <img src={life} alt="Deux chiens et leurs humains profitent ensemble d’une promenade dans une prairie" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative z-10 max-w-xl pt-28 sm:pt-40">
        <p className="mb-3 flex items-center gap-2 text-sm"><PawPrint className="size-5" aria-hidden />Nargis · Loiret · Ensemble, à leur rythme</p>
        <h1 className="text-3xl leading-tight sm:text-4xl">La Voix du Chien</h1>
        <p className="mt-3 text-lg">Le chien au cœur. L’humain à ses côtés.</p>
        <p className="mt-3 max-w-lg text-base">Des rencontres, des petites étapes et de l’entraide pour mieux vivre ensemble, sans jugement ni compétition.</p>
      </div>
    </section>
    <section aria-labelledby="values-title">
      <h2 id="values-title" className="text-2xl">Une association, des liens qui comptent</h2>
      <p className="mt-3 text-muted-foreground">Association La Voix du Chien réunit particuliers, bénévoles et professionnels autour du bien-être physique, émotionnel et social du chien, dans une approche respectueuse, éthique et scientifiquement fondée.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{[
        {Icon:Leaf,title:'À son rythme',text:'Écouter les besoins de chaque chien, sans le comparer aux autres.'},
        {Icon:HeartHandshake,title:'Avec bienveillance',text:'Trouver sa place, demander de l’aide et partager ses savoir-faire.'},
        {Icon:PawPrint,title:'Ensemble',text:'Coopérer avec des professionnels, dans le respect de chacun.'},
      ].map(({Icon,title,text}) => <article key={title} className="panel p-4"><Icon className="mb-3 size-6 text-primary" aria-hidden /><h3 className="text-base">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>)}</div>
    </section>
    <section aria-labelledby="month-title">
      <h2 id="month-title" className="flex items-center gap-2 text-xl"><CalendarDays className="size-5 text-primary" aria-hidden />Les prochaines activités du mois</h2>
      <p className="mt-2 text-sm text-muted-foreground">Uniquement les activités ouvertes au public ; les inscriptions se font dans l’espace membres.</p>
      {query.isPending ? <p role="status" className="mt-4 text-sm">Chargement des rencontres…</p> : query.isError ? <p className="mt-4 text-sm">Les activités ne sont pas disponibles pour le moment.</p> : !query.data?.activities.length ? <p className="panel mt-4 p-4 text-sm text-muted-foreground">De nouvelles rencontres se préparent. Revenez bientôt découvrir le programme.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{query.data.activities.map(a => <article key={a.id} className="panel p-4"><p className="text-sm font-medium text-primary">{new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'})}</p><h3 className="mt-2 text-lg">{a.title}</h3>{a.location && <p className="mt-2 flex gap-2 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden />{a.location}</p>}</article>)}</div>}
    </section>
    <div className="flex flex-wrap gap-3">
      {showPartnerLink && <Link to="/association" hash="partenaires" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium"><HeartHandshake className="size-5" aria-hidden />Découverte des partenaires</Link>}
      {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm">Notre site internet<ArrowUpRight className="size-4" aria-hidden /></a>}
    </div>
  </div>;
}