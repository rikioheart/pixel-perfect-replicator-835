import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { mergePublicPartners, parseWordPressPartners, type PublicPartner } from './public-partners';

export const getPublicPartners = createServerFn({method: 'GET'}).handler(async () => {
  const editorial = async () => {
    const response = await fetch('https://lavoixduchien.fr/wp-json/wp/v2/pages?slug=partenaires&_fields=content', {signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error(`Site de l’association [${response.status}]`);
    const body = await response.text();
    // Elementor currently prepends style tags to the REST response.
    const start = body.search(/\[\s*\{/);
    if (start < 0) throw new Error('Réponse de l’annuaire non reconnue');
    const pages = JSON.parse(body.slice(start)) as {content?: {rendered?: string}}[];
    const html = pages[0]?.content?.rendered;
    if (!html) throw new Error('Page partenaires indisponible');
    const partners = parseWordPressPartners(html);
    if (!partners.length) throw new Error('Présentation de l’annuaire modifiée');
    return partners;
  };
  const published = async (): Promise<PublicPartner[]> => {
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const url = process.env['SUPABASE_URL'];
    if (!key || !url) throw new Error('Lecture publique indisponible');
    const client = createClient<Database>(url, key, {auth: {persistSession:false, autoRefreshToken:false}, global: {fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey',key); return fetch(input,{...init,headers,signal:AbortSignal.timeout(12000)});
    }}});
    const {data, error} = await client.rpc('list_public_pros');
    if (error) throw error;
    const rows = (data ?? []) as unknown as {slug:string;display_name:string;specialties:string[];sector:string|null;public_city:string|null}[];
    return rows.map(row => ({id:`pro-${row.slug}`, name:row.display_name, kind:'services', description:'', specialties:row.specialties ?? [], sector:[row.sector,row.public_city].filter(Boolean).join(' · '), hours:'', links:[], slug:row.slug, source:'platform'}));
  };
  const [website, platform] = await Promise.allSettled([editorial(), published()]);
  for (const result of [website, platform]) if (result.status === 'rejected') console.error('Public partner source unavailable:', result.reason);
  return {partners: mergePublicPartners(website.status === 'fulfilled' ? website.value : [], platform.status === 'fulfilled' ? platform.value : []), websiteUnavailable: website.status === 'rejected', platformUnavailable: platform.status === 'rejected'};
});