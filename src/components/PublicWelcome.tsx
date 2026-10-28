import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { HeartHandshake, CalendarDays, ArrowUpRight, BookOpen, QrCode, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import walk from '@/assets/public/walk.asset.json';
import logoMark from '@/assets/logo-lvdc-mark.png.asset.json';
import { Button } from '@/components/ui/button';
import { OfflineStatus } from './OfflineStatus';
import { CONTACT_EMAIL, SOCIAL_LINKS } from '@/lib/contact';

type Home = { activities: {id:string;title:string;date:string;location:string|null;image_url:string|null}[]; website:string|null };
export function safeWebsite(value: string | null | undefined) {
  try { const u = new URL(value || ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function PublicWelcome({ showPartnerLink = true }: { showPartnerLink?: boolean }) {
  const query = useQuery({queryKey:['public-home'], queryFn:async () => { const {data,error} = await supabase.rpc('get_public_home'); if(error) throw error; return data as unknown as Home; }});
  useEffect(() => { if(query.data) {try {localStorage.setItem('lvdc.public.home',JSON.stringify({...query.data,savedAt:new Date().toISOString()}));}catch{/* unavailable device storage */}} },[query.data]);
  const website = safeWebsite(query.data?.website);
  const { session } = useAuth();
  return <div className="contents">
    <OfflineStatus />
    <section className="public-hero">
      <img src={walk.url} alt="Des chiens et leurs humains se promènent ensemble sur un chemin" width={1920} height={1088} fetchPriority="high" />
      <div className="public-hero-copy">
        <p className="hero-label"><img src={logoMark.url} alt="" aria-hidden className="size-6 rounded-full bg-background object-contain" />Espace terrain de l’association</p>
        <h1>La Voix<br />du Chien</h1>
        <p className="hero-slogan">Le chien au cœur. L’humain à ses côtés.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {session
            ? <Button asChild size="lg"><Link to="/loyalty"><QrCode aria-hidden />Mon Pass Terrain</Link></Button>
            : <Button asChild size="lg"><Link to="/" hash="connexion"><QrCode aria-hidden />Mon Pass Terrain</Link></Button>}
          {!session && <Button asChild variant="secondary" size="lg"><Link to="/" hash="connexion">Accès membre</Link></Button>}
        </div>
        <p className="mt-3 text-sm opacity-90">{session ? 'Votre pass s’ouvre directement. Gardez la session ouverte pour l’afficher sans réseau.' : 'Connectez-vous une première fois pour afficher votre pass ; il reste ensuite disponible sans réseau.'}</p>
      </div>
    </section>
    <nav aria-label="Accès rapides" className="public-discovery">
      <Link to="/agenda"><CalendarDays className="size-5" aria-hidden /><span>Prochaines activités</span></Link>
      {showPartnerLink && <Link to="/professionnels"><HeartHandshake className="size-5" aria-hidden /><span>Annuaire des partenaires</span></Link>}
      <a href={website ?? 'https://lavoixduchien.fr/'} target="_blank" rel="noopener noreferrer"><BookOpen className="size-5" aria-hidden /><span>L’association, l’adhésion et nos articles</span><ArrowUpRight className="size-4" aria-hidden /></a>
      <a href={`mailto:${CONTACT_EMAIL}`}><Mail className="size-5" aria-hidden /><span>Nous écrire</span></a>
    </nav>
    <p className="mx-auto flex max-w-7xl flex-wrap gap-x-4 gap-y-1 px-5 pb-6 text-sm text-muted-foreground sm:px-8">Suivez-nous :{SOCIAL_LINKS.slice(0, 2).map((s) => <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">{s.label}</a>)}</p>
  </div>;
}
