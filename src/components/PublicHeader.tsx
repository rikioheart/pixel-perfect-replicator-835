import { Link } from '@tanstack/react-router';
import logoMark from '@/assets/logo-lvdc-mark.png.asset.json';
import { Button } from '@/components/ui/button';

export function PublicHeader() {
  const link = 'rounded-md px-2 py-1 text-sm hover:underline [&.active]:underline';
  return (
    <header className="surface-night">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/association" className="flex items-center gap-3">
          <img src={logoMark.url} alt="Logo La Voix du Chien" className="size-10 rounded-full bg-navy-foreground/10 object-contain p-1" />
          <span className="font-display">La Voix du Chien</span>
        </Link>
        <nav aria-label="Pages publiques" className="flex flex-wrap items-center gap-1">
          <Link to="/association" className={link}>Association</Link>
          <Link to="/articles" className={link}>Articles</Link>
          <Link to="/professionnels" className={link}>Professionnels</Link>
          <Button asChild variant="outline" size="sm" className="ml-2"><Link to="/">Espace membres</Link></Button>
        </nav>
      </div>
    </header>
  );
}
