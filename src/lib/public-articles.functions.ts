import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { parseWordPressPosts, type PlatformArticle } from './public-articles';

export const getWordPressArticles = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const res = await fetch('https://lavoixduchien.fr/wp-json/wp/v2/posts?per_page=30&_fields=id,title,link,date,excerpt,content', { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Site de l’association [${res.status}]`);
    const body = await res.text();
    const start = body.search(/\[\s*\{|\[\s*\]/);
    return { articles: start < 0 ? [] : parseWordPressPosts(JSON.parse(body.slice(start))), unavailable: false };
  } catch (e) {
    console.error('WordPress articles unavailable:', e);
    return { articles: [], unavailable: true };
  }
});

/** Articles publiés depuis la plateforme. Les fichiers (privés) ne sont signés que pour les articles publiés. */
export const getPlatformArticles = createServerFn({ method: 'GET' }).handler(async () => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) return [] as PlatformArticle[];
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key); return fetch(input, { ...init, headers });
  } } });
  const { data, error } = await client.rpc('list_public_blog_posts');
  if (error) { console.error('list_public_blog_posts failed:', error); return [] as PlatformArticle[]; }
  const rows = (data ?? []) as { id: string; title: string; excerpt: string | null; content: string | null; cover: string | null; attachment: string | null; attachment_name: string | null; date: string }[];
  const paths = rows.flatMap((r) => [r.cover, r.attachment]).filter((p): p is string => !!p && !/^https?:/.test(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    // Privileged only to sign files already referenced by PUBLISHED posts (list above is RLS-independent but filtered).
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: urls } = await supabaseAdmin.storage.from('blog-media').createSignedUrls(paths, 60 * 60 * 6);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const resolve = (p: string | null) => (!p ? null : /^https:/.test(p) ? p : signed.get(p) ?? null);
  return rows.map((r) => {
    const file = resolve(r.attachment);
    return { id: r.id, title: r.title, excerpt: r.excerpt ?? '', content: r.content ?? '', date: r.date, image: resolve(r.cover), attachment: file ? { name: r.attachment_name || 'Document PDF', url: file } : null, source: 'platform' as const };
  });
});

export type PublicPro = { slug: string; name: string; specialties: string[]; sector: string | null; city: string | null };

/** Professionnels publiés et validés par le Bureau (RPC publique existante). */
export const getPublicPros = createServerFn({ method: 'GET' }).handler(async () => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) return { pros: [] as PublicPro[], unavailable: true };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key); return fetch(input, { ...init, headers });
  } } });
  const { data, error } = await client.rpc('list_public_pros');
  if (error) { console.error('list_public_pros failed:', error); return { pros: [] as PublicPro[], unavailable: true }; }
  const rows = (data ?? []) as { slug: string; display_name: string; specialties: string[] | null; sector: string | null; public_city: string | null }[];
  return { pros: rows.map((r) => ({ slug: r.slug, name: r.display_name, specialties: r.specialties ?? [], sector: r.sector, city: r.public_city })), unavailable: false };
});
