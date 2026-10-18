import { Link } from '@tanstack/react-router';
import logoMark from '@/assets/logo-lvdc-mark.png.asset.json';
import { Button } from '@/components/ui/button';
import { ZONES } from '@/lib/site-content';
import { useState } from 'react';
import { Menu, X, LogIn, PawPrint } from 'lucide-react';

const NAV = [
  { to: '/association', label: 'Association' },
  { to: '/services', label: 'Activités' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/professionnels', label: 'Professionnels' },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const link = 'public-nav-link';
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
          <Button asChild variant="outline" size="sm" className="public-member-button"><Link to="/" hash="connexion" onClick={() => setOpen(false)}><LogIn aria-hidden /><span className="hidden sm:inline">Espace membres</span><span className="sm:hidden">Connexion</span></Link></Button>
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
    <footer className="public-footer">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 text-sm md:grid-cols-[1.4fr_1fr_1fr] sm:px-8">
        <div><PawPrint className="mb-4 size-7 text-ochre" aria-hidden /><p className="font-display text-xl">La Voix du Chien</p><p className="mt-3 max-w-xs opacity-80">Le chien au cœur, l’humain à ses côtés.</p><p className="mt-5 text-xs opacity-70">Association · Nargis, Loiret</p></div>
        <div><p className="font-medium">Un réseau de proximité</p><ul className="mt-4 space-y-2 opacity-80">{ZONES.map((z) => <li key={z}>{z}</li>)}</ul></div>
        <div><p className="mb-3 font-medium">Explorer le site</p><nav aria-label="Pied de page" className="grid gap-1">{NAV.map((n) => <Link key={n.to} to={n.to} className="w-fit py-1 hover:underline">{n.label}</Link>)}<a href="https://lavoixduchien.fr/" target="_blank" rel="noopener noreferrer" className="w-fit py-1 hover:underline">Site officiel et articles ↗</a></nav></div>
      </div>
      <div className="mx-auto max-w-7xl border-t border-navy-foreground/20 px-5 py-5 text-xs text-navy-foreground/70 sm:px-8">La Voix du Chien · Respect, coopération et entraide</div>
    </footer>
  );
}
