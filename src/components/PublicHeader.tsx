import { Link } from '@tanstack/react-router';
import logoMark from '@/assets/logo-lvdc-mark.png.asset.json';
import { Button } from '@/components/ui/button';
import { ZONES } from '@/lib/site-content';
import { useState } from 'react';
import { Menu, X, LogIn, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { CONTACT_EMAIL, SOCIAL_LINKS } from '@/lib/contact';

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/professionnels', label: 'Partenaires' },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const link = 'public-nav-link';
  const { session } = useAuth();
  return (
    <header className="public-header">
      <a href="#contenu" className="public-skip">Aller au contenu</a>
      <div className="public-header-inner">
        <Link to="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          <img src={logoMark.url} alt="Logo La Voix du Chien" className="size-12 shrink-0 rounded-full object-contain" />
          <span className="font-display text-sm leading-snug sm:text-base">La Voix du Chien<span className="block font-sans text-xs text-muted-foreground">Le chien au cœur</span></span>
        </Link>
        <nav aria-label="Pages du site" className="hidden items-center gap-1 xl:flex">
          {NAV.map((n) => <Link key={n.to} to={n.to} className={link}>{n.label}</Link>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {session
            ? <Button asChild variant="outline" size="sm" className="public-member-button"><Link to="/member" onClick={() => setOpen(false)}><ArrowLeft aria-hidden /><span className="hidden sm:inline">Retour à mon espace</span><span className="sm:hidden">Mon espace</span></Link></Button>
            : <Button asChild variant="outline" size="sm" className="public-member-button"><Link to="/" hash="connexion" onClick={() => setOpen(false)}><LogIn aria-hidden /><span className="hidden sm:inline">Espace membres</span><span className="sm:hidden">Connexion</span></Link></Button>}
          <Button variant="ghost" size="icon" className="xl:hidden" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} aria-controls="public-mobile-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
        </div>
      </div>
      {open && <nav id="public-mobile-nav" aria-label="Pages du site sur mobile" className="public-mobile-nav xl:hidden" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
        {NAV.map(n => <Link key={n.to} to={n.to} className={link} onClick={() => setOpen(false)}>{n.label}</Link>)}
      </nav>}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer" id="contact">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr] sm:px-8">
        <div><img src={logoMark.url} alt="" aria-hidden className="mb-4 size-12 rounded-full bg-background object-contain p-1" /><p className="font-display text-xl">La Voix du Chien</p><p className="mt-3 max-w-xs opacity-80">Le chien au cœur, l’humain à ses côtés.</p><p className="mt-5 text-xs opacity-70">Association · Nargis, Loiret</p></div>
        <div><p className="font-medium">Un réseau de proximité</p><ul className="mt-4 space-y-2 opacity-80">{ZONES.map((z) => <li key={z}>{z}</li>)}</ul></div>
        <div><p className="mb-3 font-medium">Nous écrire</p><a href={`mailto:${CONTACT_EMAIL}`} className="break-all hover:underline">{CONTACT_EMAIL}</a><nav aria-label="Réseaux sociaux" className="mt-3 grid gap-1">{SOCIAL_LINKS.map((s) => <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="w-fit py-1 hover:underline">{s.label} ↗</a>)}</nav></div>
        <div><p className="mb-3 font-medium">Explorer le site</p><nav aria-label="Pied de page" className="grid gap-1">{NAV.map((n) => <Link key={n.to} to={n.to} className="w-fit py-1 hover:underline">{n.label}</Link>)}</nav></div>
      </div>
      <div className="mx-auto max-w-7xl border-t border-navy-foreground/20 px-5 py-5 text-xs text-navy-foreground/70 sm:px-8">La Voix du Chien · Respect, coopération et entraide</div>
    </footer>
  );
}
