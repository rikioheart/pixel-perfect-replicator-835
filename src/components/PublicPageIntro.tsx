import type { ReactNode } from 'react';
import logoMark from '@/assets/logo-lvdc-mark.png.asset.json';

export function PublicPageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="public-page-intro">
    <p className="public-eyebrow"><img src={logoMark.url} alt="" aria-hidden className="size-5 rounded-full object-contain" />{eyebrow}</p>
    <h1>{title}</h1>
    <div className="mt-5 max-w-2xl text-muted-foreground">{children}</div>
  </section>;
}
