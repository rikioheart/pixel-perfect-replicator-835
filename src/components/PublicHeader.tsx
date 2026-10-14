import { Link } from '@tanstack/react-router';
import logoMark from '@/assets/logo-lvdc-mark.png.asset.json';
import { Button } from '@/components/ui/button';
import { ZONES } from '@/lib/site-content';

const NAV = [
  { to: '/association', label: 'Association' },
  { to: '/services', label: 'Activités' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/articles', label: 'Articles' },
  { to: '/professionnels', label: 'Professionnels' },
] as const;

export function PublicHeader() {
  const link = 'rounded-md px-2 py-1 text-sm hover:underline [&.active]:underline';
  return (
    <header className="surface-night">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoMark.url} alt="Logo La Voix du Chien" className="size-10 rounded-full bg-navy-foreground/10 object-contain p-1" />
          <span className="font-display">La Voix du Chien</span>
        </Link>
        <nav aria-label="Pages du site" className="flex flex-wrap items-center gap-1">
          {NAV.map((n) => <Link key={n.to} to={n.to} className={link}>{n.label}</Link>)}
          <Button asChild variant="outline" size="sm" className="ml-2"><Link to="/" hash="connexion">Espace membres</Link></Button>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="surface-night mt-10">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-8">
        <div><p className="font-display text-base">Association La Voix du Chien</p><p className="mt-2 opacity-80">Le chien au cœur, l’humain à ses côtés.</p></div>
        <div><p className="font-medium">Notre réseau de proximité</p><ul className="mt-2 space-y-1 opacity-80">{ZONES.map((z) => <li key={z}>{z}</li>)}</ul></div>
        <div className="flex flex-col gap-1">{NAV.map((n) => <Link key={n.to} to={n.to} className="hover:underline">{n.label}</Link>)}</div>
      </div>
    </footer>
  );
}
