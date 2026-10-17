const origin = 'https://plateforme-la-voix-du-chien.lovable.app';

/** Self-referencing URLs belong to public leaf routes, never the shared root. */
export function publicSeo(path: string) {
  const url = `${origin}${path}`;
  return { links: [{ rel: 'canonical', href: url }], meta: [{ property: 'og:url', content: url }] };
}